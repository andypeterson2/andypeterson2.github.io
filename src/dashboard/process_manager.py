from __future__ import annotations

import asyncio
import json
import os
from collections import defaultdict
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, Protocol

from dashboard.config import ServiceConfig

ServiceStatus = Literal["stopped", "starting", "running", "stopping", "crashed"]


class ServiceResolver(Protocol):
    def __call__(self, name: str) -> ServiceConfig: ...


@dataclass
class ServiceInstance:
    service_name: str
    port: int
    project_name: str = ""
    container_name: str = ""
    compose_file: Path | None = None
    compose_service: str = ""
    status: ServiceStatus = "stopped"
    pid: int | None = None
    started_at: datetime | None = None

    @property
    def is_alive(self) -> bool:
        return self.status in ("starting", "running")


async def _compose(
    compose_file: Path,
    project_name: str,
    *args: str,
    env: dict[str, str] | None = None,
) -> tuple[str, str, int]:
    """Run a docker compose command and return (stdout, stderr, returncode)."""
    cmd = [
        "docker",
        "compose",
        "-f",
        str(compose_file),
        "--project-name",
        project_name,
        *args,
    ]
    full_env = os.environ.copy()
    if env:
        full_env.update(env)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=full_env,
    )
    stdout, stderr = await proc.communicate()
    return (
        stdout.decode("utf-8", errors="replace").strip(),
        stderr.decode("utf-8", errors="replace").strip(),
        proc.returncode or 0,
    )


async def _docker(*args: str) -> tuple[str, str, int]:
    """Run a plain docker command."""
    proc = await asyncio.create_subprocess_exec(
        "docker",
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return (
        stdout.decode("utf-8", errors="replace").strip(),
        stderr.decode("utf-8", errors="replace").strip(),
        proc.returncode or 0,
    )


class ProcessManager:
    def __init__(self, get_service: ServiceResolver) -> None:
        self._get_service = get_service
        self._instances: dict[str, list[ServiceInstance]] = defaultdict(list)

    async def start(self, service_name: str, port: int) -> ServiceInstance:
        svc = self._get_service(service_name)
        project_name = f"dashboard-{service_name}-{port}"
        container_name = f"{project_name}-{svc.compose_service}-1"

        instance = ServiceInstance(
            service_name=service_name,
            port=port,
            project_name=project_name,
            container_name=container_name,
            compose_file=svc.compose_file,
            compose_service=svc.compose_service,
            status="starting",
        )

        # Build the environment for compose commands
        compose_env = {"PORT": str(port)}
        if svc.environment:
            compose_env.update(svc.environment)

        # Tear down any stale project with the same name
        await _compose(
            svc.compose_file,
            project_name,
            "down",
            "--remove-orphans",
            env=compose_env,
        )

        # Start the service
        _stdout, stderr, rc = await _compose(
            svc.compose_file,
            project_name,
            "up",
            "-d",
            "--build",
            svc.compose_service,
            env=compose_env,
        )
        if rc != 0:
            instance.status = "stopped"
            raise RuntimeError(f"docker compose up failed: {stderr}")

        # Get container PID
        pid_out, _, _ = await _docker("inspect", "--format", "{{.State.Pid}}", container_name)
        try:
            instance.pid = int(pid_out)
        except ValueError:
            instance.pid = None

        instance.status = "running"
        instance.started_at = datetime.now(UTC)
        self._instances[service_name].append(instance)
        return instance

    async def check_container_status(self, instance: ServiceInstance) -> str:
        """Check if a container is actually running after start.

        Returns the container state string (e.g. 'running', 'exited',
        'restarting', 'dead') or 'unknown' on failure.
        """
        if not instance.container_name:
            return "unknown"
        # Brief pause to let the container settle
        await asyncio.sleep(0.5)
        stdout, _, rc = await _docker(
            "inspect", "--format", "{{.State.Status}}", instance.container_name
        )
        if rc != 0:
            return "unknown"
        return stdout.strip().lower()

    async def get_host_url(self, instance: ServiceInstance) -> str:
        """Resolve the host-accessible URL for a running container.

        Inspects Docker port bindings to find the actual host IP/port.
        Falls back to http://localhost:{port} if inspection fails.
        """
        fallback = f"http://localhost:{instance.port}"
        if not instance.container_name:
            return fallback
        try:
            stdout, _, rc = await _docker(
                "inspect",
                "--format",
                "{{json .NetworkSettings.Ports}}",
                instance.container_name,
            )
            if rc != 0 or not stdout:
                return fallback
            ports = json.loads(stdout)
            # Search all port bindings for one whose HostPort matches
            for _key, bindings in (ports or {}).items():
                if not bindings:
                    continue
                for binding in bindings:
                    host_port = binding.get("HostPort", "")
                    if host_port == str(instance.port):
                        host_ip = binding.get("HostIp", "")
                        if not host_ip or host_ip in ("0.0.0.0", "::", "127.0.0.1", "::1"):
                            host_ip = "localhost"
                        return f"http://{host_ip}:{host_port}"
            # If no matching port found, try the first binding available
            for _key, bindings in (ports or {}).items():
                if bindings:
                    binding = bindings[0]
                    host_ip = binding.get("HostIp", "")
                    host_port = binding.get("HostPort", str(instance.port))
                    if not host_ip or host_ip in ("0.0.0.0", "::", "127.0.0.1", "::1"):
                        host_ip = "localhost"
                    return f"http://{host_ip}:{host_port}"
        except Exception:
            pass
        return fallback

    async def fetch_recent_logs(
        self, instance: ServiceInstance, tail: int = 20
    ) -> AsyncIterator[tuple[str, str]]:
        """Fetch the last N log lines from a container (not streaming)."""
        if not instance.container_name:
            return
        proc = await asyncio.create_subprocess_exec(
            "docker",
            "logs",
            "--tail",
            str(tail),
            instance.container_name,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_bytes, stderr_bytes = await proc.communicate()
        for line in stdout_bytes.decode("utf-8", errors="replace").splitlines():
            if line.strip():
                yield (line.rstrip(), "stdout")
        for line in stderr_bytes.decode("utf-8", errors="replace").splitlines():
            if line.strip():
                yield (line.rstrip(), "stderr")

    def watch_for_exit(self, instance: ServiceInstance) -> asyncio.Task[int | None]:
        """Monitor a container and mark it crashed if it exits unexpectedly."""

        async def _watch() -> int | None:
            if not instance.container_name:
                return None
            stdout, _, _ = await _docker("wait", instance.container_name)
            try:
                returncode = int(stdout)
            except ValueError:
                returncode = -1
            if instance.status == "running":
                instance.status = "crashed"
            return returncode

        return asyncio.create_task(_watch())

    async def stop(self, instance: ServiceInstance, timeout: float = 5.0) -> None:
        if not instance.is_alive:
            instance.status = "stopped"
            if instance.compose_file and instance.project_name:
                await _compose(
                    instance.compose_file,
                    instance.project_name,
                    "down",
                    env={"PORT": str(instance.port)},
                )
            return

        instance.status = "stopping"
        await _compose(
            instance.compose_file,
            instance.project_name,
            "stop",
            "-t",
            str(int(timeout)),
            instance.compose_service,
            env={"PORT": str(instance.port)},
        )
        await _compose(
            instance.compose_file,
            instance.project_name,
            "down",
            env={"PORT": str(instance.port)},
        )
        instance.status = "stopped"

    async def restart(self, instance: ServiceInstance) -> ServiceInstance:
        service_name = instance.service_name
        port = instance.port

        await self.stop(instance)
        if instance in self._instances[service_name]:
            self._instances[service_name].remove(instance)

        return await self.start(service_name, port)

    async def shutdown_all(self) -> None:
        tasks = []
        for instances in self._instances.values():
            for inst in instances:
                tasks.append(self.stop(inst))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def stream_output(self, instance: ServiceInstance) -> AsyncIterator[tuple[str, str]]:
        """Yield (line, stream_name) as lines arrive from the container."""
        if not instance.container_name:
            return

        proc = await asyncio.create_subprocess_exec(
            "docker",
            "logs",
            "-f",
            instance.container_name,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        queue: asyncio.Queue[tuple[str, str] | None] = asyncio.Queue()
        active_readers = 2

        async def _reader(stream: asyncio.StreamReader | None, label: str) -> None:
            nonlocal active_readers
            if stream is None:
                active_readers -= 1
                if active_readers == 0:
                    await queue.put(None)
                return
            try:
                while True:
                    line_bytes = await stream.readline()
                    if not line_bytes:
                        break
                    text = line_bytes.decode("utf-8", errors="replace").rstrip()
                    await queue.put((text, label))
            finally:
                active_readers -= 1
                if active_readers == 0:
                    await queue.put(None)

        _task_out = asyncio.create_task(_reader(proc.stdout, "stdout"))
        _task_err = asyncio.create_task(_reader(proc.stderr, "stderr"))

        while True:
            item = await queue.get()
            if item is None:
                break
            yield item

    def get_instances(self, service_name: str) -> list[ServiceInstance]:
        return list(self._instances.get(service_name, []))

    def get_all_instances(self) -> dict[str, list[ServiceInstance]]:
        return dict(self._instances)

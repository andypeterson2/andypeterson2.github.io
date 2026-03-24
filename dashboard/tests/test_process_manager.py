from __future__ import annotations

import asyncio
import textwrap
from pathlib import Path

import pytest
import yaml

from dashboard.config import load_config
from dashboard.process_manager import ProcessManager
from tests.conftest import _make_repo


class TestProcessManager:
    @pytest.fixture(autouse=True)
    def _require_docker(self, require_docker):
        """Skip all ProcessManager tests if Docker is not available."""

    @pytest.fixture()
    def echo_config(self, tmp_path: Path) -> Path:
        _make_repo(
            tmp_path,
            "echo-repo",
            svc_name="echo",
            display_name="Echo",
            compose_service="echo",
            default_port=9000,
            compose_yml=textwrap.dedent("""\
                services:
                  echo:
                    image: alpine
                    command: echo port=${PORT:-9000}
            """),
        )
        _make_repo(
            tmp_path,
            "sleeper-repo",
            svc_name="sleeper",
            display_name="Sleeper",
            compose_service="sleeper",
            default_port=9001,
            compose_yml=textwrap.dedent("""\
                services:
                  sleeper:
                    image: alpine
                    command: sleep 60
            """),
        )
        data = {
            "projects_root": str(tmp_path),
        }
        cfg_path = tmp_path / "config.yaml"
        cfg_path.write_text(yaml.dump(data))
        return cfg_path

    @pytest.mark.asyncio
    async def test_start_creates_instance(self, echo_config: Path) -> None:
        cfg = load_config(echo_config)
        pm = ProcessManager(cfg.get_service)
        inst = await pm.start("echo", 9000)
        assert inst.pid is not None
        assert inst.service_name == "echo"
        assert inst.port == 9000
        assert inst.started_at is not None
        assert inst.project_name == "dashboard-echo-9000"
        assert inst.container_name == "dashboard-echo-9000-echo-1"
        await pm.shutdown_all()

    @pytest.mark.asyncio
    async def test_stop_terminates_process(self, echo_config: Path) -> None:
        cfg = load_config(echo_config)
        pm = ProcessManager(cfg.get_service)
        inst = await pm.start("sleeper", 9001)
        assert inst.is_alive
        await pm.stop(inst)
        assert inst.status == "stopped"
        assert not inst.is_alive

    @pytest.mark.asyncio
    async def test_restart_returns_new_instance(self, echo_config: Path) -> None:
        cfg = load_config(echo_config)
        pm = ProcessManager(cfg.get_service)
        inst1 = await pm.start("sleeper", 9001)
        pid1 = inst1.pid
        inst2 = await pm.restart(inst1)
        assert inst2.pid != pid1
        assert inst2.port == 9001
        await pm.shutdown_all()

    @pytest.mark.asyncio
    async def test_multiple_instances(self, echo_config: Path) -> None:
        cfg = load_config(echo_config)
        pm = ProcessManager(cfg.get_service)
        await pm.start("sleeper", 9001)
        await pm.start("sleeper", 9002)
        instances = pm.get_instances("sleeper")
        assert len(instances) == 2
        assert {i.port for i in instances} == {9001, 9002}
        await pm.shutdown_all()

    @pytest.mark.asyncio
    async def test_shutdown_all(self, echo_config: Path) -> None:
        cfg = load_config(echo_config)
        pm = ProcessManager(cfg.get_service)
        await pm.start("sleeper", 9001)
        await pm.start("sleeper", 9002)
        await pm.shutdown_all()
        for inst in pm.get_instances("sleeper"):
            assert inst.status == "stopped"

    @pytest.mark.asyncio
    async def test_stream_output(self, echo_config: Path) -> None:
        cfg = load_config(echo_config)
        pm = ProcessManager(cfg.get_service)
        inst = await pm.start("echo", 9000)
        await asyncio.sleep(2)  # container startup + exit
        lines = []
        async for line, stream in pm.stream_output(inst):
            lines.append((line, stream))
        assert len(lines) >= 1
        assert lines[0][0] == "port=9000"
        assert lines[0][1] == "stdout"
        await pm.shutdown_all()

    @pytest.mark.asyncio
    async def test_stop_already_stopped(self, echo_config: Path) -> None:
        cfg = load_config(echo_config)
        pm = ProcessManager(cfg.get_service)
        inst = await pm.start("echo", 9000)
        await asyncio.sleep(2)  # let echo exit
        await pm.stop(inst)
        assert inst.status == "stopped"

    @pytest.mark.asyncio
    async def test_watch_for_exit_marks_crashed(self, echo_config: Path) -> None:
        cfg = load_config(echo_config)
        pm = ProcessManager(cfg.get_service)
        inst = await pm.start("echo", 9000)
        task = pm.watch_for_exit(inst)
        returncode = await task
        assert inst.status == "crashed"
        assert returncode == 0
        await pm.shutdown_all()

    @pytest.mark.asyncio
    async def test_watch_for_exit_not_crashed_if_stopped(self, echo_config: Path) -> None:
        cfg = load_config(echo_config)
        pm = ProcessManager(cfg.get_service)
        inst = await pm.start("sleeper", 9001)
        task = pm.watch_for_exit(inst)
        await pm.stop(inst)
        await task
        assert inst.status == "stopped"

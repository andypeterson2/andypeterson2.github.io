/**
 * Cameras and microphones: which exist, which to use, and what went wrong.
 *
 * The page does not ask for permission on load. A visitor who only wants the
 * simulation needs no camera at all, and a prompt nobody asked for is both
 * rude and widely auto-blocked. Instead, where permission has already been
 * granted the devices are listed on arrival with no prompt; where it has not,
 * a button asks.
 *
 * `enumerateDevices` returns empty labels until permission exists once, so an
 * unlabelled list means "not yet allowed", not "nothing attached" — a
 * distinction worth keeping, because they look the same otherwise.
 */

const STORAGE_KEY = 'qvc.devices';

export interface Device {
  id: string;
  label: string;
}

export interface DeviceSet {
  cameras: Device[];
  microphones: Device[];
  /** Whether the labels are real, which only happens once permission exists. */
  labelled: boolean;
}

export interface DeviceChoice {
  cameraId: string | null;
  microphoneId: string | null;
}

/** Which devices the visitor picked last time, if any. */
export function loadChoice(): DeviceChoice {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    const saved = raw as Partial<DeviceChoice>;
    return {
      cameraId: typeof saved.cameraId === 'string' ? saved.cameraId : null,
      microphoneId: typeof saved.microphoneId === 'string' ? saved.microphoneId : null,
    };
  } catch {
    return { cameraId: null, microphoneId: null };
  }
}

export function saveChoice(choice: DeviceChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // Storage unavailable: the choice lasts for this page view.
  }
}

/**
 * Whether the camera is already permitted, without asking. Some browsers do
 * not implement the query, and an unknown answer is treated as "not yet".
 */
export async function alreadyPermitted(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: 'camera' });
    return status.state === 'granted';
  } catch {
    return false;
  }
}

/** The devices this browser will admit to, labelled only once permitted. */
export async function listDevices(): Promise<DeviceSet> {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    const pick = (kind: MediaDeviceKind): Device[] =>
      all
        .filter((d) => d.kind === kind)
        .map((d, i) => ({
          id: d.deviceId,
          label: d.label || `${kind === 'videoinput' ? 'Camera' : 'Microphone'} ${String(i + 1)}`,
        }));
    const cameras = pick('videoinput');
    const microphones = pick('audioinput');
    return {
      cameras,
      microphones,
      labelled: all.some((d) => d.label !== ''),
    };
  } catch {
    return { cameras: [], microphones: [], labelled: false };
  }
}

/** Constraints for a choice; a device that has gone away falls back to any. */
export function constraintsFor(choice: DeviceChoice): MediaStreamConstraints {
  const video: MediaTrackConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  };
  const audio: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  // `ideal` rather than `exact`, so a remembered device that is now unplugged
  // costs a fallback and the call still starts.
  if (choice.cameraId) video.deviceId = { ideal: choice.cameraId };
  if (choice.microphoneId) audio.deviceId = { ideal: choice.microphoneId };
  return { video, audio };
}

/**
 * What a getUserMedia failure actually was. Reporting "permission denied" for
 * all of these sends people to a settings page that is already correct.
 */
export function mediaFailure(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Access was refused. On Windows this is often the system setting rather than the browser: Settings → Privacy & security → Camera.';
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The camera or microphone is held by another application. Close it and try again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'The chosen camera or microphone is no longer attached. Pick another below.';
  }
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return `The camera could not be started — ${detail}`;
}

/** Stop every track, so the device light goes out and the handle is released. */
export function stopStream(stream: MediaStream | null): void {
  for (const track of stream?.getTracks() ?? []) track.stop();
}

/**
 * Quantum-video-chat shell.
 *
 * Two tiers share one page. The simulation runs the real key engine in this tab
 * with no media and no peer, so a lone visitor sees the part of the project that
 * is actually novel. The call is the live tier: it needs a pass, a second
 * person, and a camera, and it stays disabled until `navbar:connect` says the
 * gateway answered.
 *
 * Nothing here imports the engine. Both tiers load it on demand, so the lobby
 * costs a few kilobytes and a static Lighthouse run logs no refused socket.
 */

/** Controls the live tier owns; disabled until the gateway answers. */
const LIVE_CONTROLS = ['qvc-create', 'qvc-room-input', 'qvc-join'] as const;

function setLiveEnabled(enabled: boolean): void {
  for (const id of LIVE_CONTROLS) {
    const el = document.getElementById(id);
    if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) el.disabled = !enabled;
  }
  const note = document.getElementById('qvc-live-note');
  if (note) {
    note.textContent = enabled
      ? 'Start a call and send the invite link to the person you want to call.'
      : 'A real call needs a pass and a second person. Connect above to enable it.';
  }
}

function bindLobby(): void {
  const demo = document.getElementById('qvc-run-demo');
  demo?.addEventListener('click', () => {
    void startDemo();
  });
  const create = document.getElementById('qvc-create');
  create?.addEventListener('click', () => {
    void import('./signalling').then(({ startCall }) => startCall());
  });
}

/** Load and start the in-tab key exchange. Imported on demand. */
async function startDemo(): Promise<void> {
  const { runDemo } = await import('./demo');
  await runDemo();
}

document.addEventListener('navbar:connect', (e) => {
  const detail = (e as CustomEvent<{ service?: string; url?: string }>).detail;
  if (detail.service !== 'qvc' || !detail.url) return;
  const url = detail.url;
  void import('./signalling').then(({ connect }) => {
    connect(url);
    setLiveEnabled(true);
  });
});

bindLobby();

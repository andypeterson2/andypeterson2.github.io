export interface Project {
  title: string;
  slug: string;
  description: string;
  status: 'active' | 'archived';
  featured: boolean;
  appUrl?: string;
  icon: string;
  repoUrl: string;
  /** Real, cited numbers shown on the one-page showcase (no handwaving). */
  metrics?: { value: string; label: string }[];
  /** Stack tags shown on the showcase card. */
  tech?: string[];
  /** Where the demo runs — shown as one chip on every card so the tier is never implied.
   *  browser: embedded here and works with nothing running on the owner's side;
   *  external: a separate app (opens in a new tab, needs its own server / a second person). */
  tier: 'browser' | 'external';
}

export const projects: Project[] = [
  {
    title: 'LaTeX Resume Editor',
    slug: 'latex-resume-editor',
    description:
      'One master resume, many targeted versions: a structured-data editor where each variant is a tag-rule lens over the same content, with checkpoint history and undo, compiled to PDF through XeLaTeX.',
    status: 'active',
    featured: true,
    appUrl: '/projects/latex-resume-editor/app/',
    tier: 'browser',
    icon: 'code.svg',
    repoUrl: 'https://github.com/andypeterson2/cv',
    metrics: [
      { value: '1 → many', label: 'variants are tag-rule lenses over one master document' },
      { value: 'no server', label: 'the demo is the real editor; sign in only to save or compile' },
      { value: '390+', label: 'tests: deterministic e2e against a mocked backend, plus unit' },
    ],
    tech: ['Svelte 5', 'Express', 'SQLite', 'Cloudflare Access', 'XeLaTeX'],
  },
  {
    title: 'Quantum Video Chat',
    slug: 'quantum-video-chat',
    description:
      'End-to-end encrypted video chat whose keys come from a simulated BB84 quantum key exchange, built at Qualcomm Institute.',
    status: 'active',
    featured: true,
    appUrl: 'https://quantum-interns-at-qualcomm-institiute.github.io/Quantum-Video-Chat/',
    tier: 'external',
    icon: 'video_dark.svg',
    repoUrl: 'https://github.com/Quantum-Interns-at-Qualcomm-Institiute/Quantum-Video-Chat',
    metrics: [
      { value: 'BB84', label: 'simulated QKD: sift → QBER → Cascade → Toeplitz' },
      { value: '> 11%', label: 'QBER trips eavesdropper detection → re-key' },
      { value: '94', label: 'tests (server + client)' },
    ],
    tech: ['WebRTC', 'BB84 QKD', 'AES-128-GCM', 'Python'],
  },
  {
    title: 'Quantum Nonogram Solver',
    slug: 'quantum-nonogram-solver',
    description:
      'Grover-based constraint-satisfaction solver, validated on real IBM quantum hardware, built at Qualcomm Institute.',
    status: 'active',
    featured: true,
    appUrl: '/projects/quantum-nonogram-solver/app/',
    tier: 'browser',
    icon: 'grid_light.svg',
    repoUrl: 'https://github.com/Quantum-Interns-at-Qualcomm-Institiute/quantum-nonogram-solver',
    metrics: [
      {
        value: '5×',
        label:
          'chance on real IBM hardware: 32.3% correct on a 2×2 puzzle vs 6.25% (47.3% noiseless)',
      },
      { value: 'in-browser', label: 'classical solver runs client-side, zero backend' },
      { value: '1,800+', label: 'backend tests' },
    ],
    tech: ['Qiskit', 'Grover', 'Flask', 'Socket.IO', 'IBM Quantum'],
  },
  {
    title: 'Quantum ML Classifier Platform',
    slug: 'quantum-ml-classifier',
    description:
      'Extensible ML platform benchmarking quantum-enhanced classifiers against classical baselines — plus a NISQ-era quantum SVM paper recreated end-to-end in Qiskit.',
    status: 'active',
    featured: true,
    appUrl: '/projects/ai-ml/app/',
    tier: 'browser',
    icon: 'microscope.svg',
    repoUrl: 'https://github.com/andypeterson2/quantum-machine-learning',
    metrics: [
      {
        value: '10×',
        label:
          'closer to ideal than the 2019 paper: its QSVM circuit on ibm_marrakesh, JS divergence 0.0127 vs 0.130',
      },
      {
        value: '97% / 91.5%',
        label:
          'Iris setosa vs versicolor (the paper’s pair) / MNIST 6 vs 9, with the paper’s QSVM rule in your browser',
      },
      { value: '92.1%', label: 'MNIST, a linear baseline predicted in your browser' },
    ],
    tech: ['PyTorch', 'Qiskit', 'SSE', 'Flask', 'Jupyter'],
  },
];

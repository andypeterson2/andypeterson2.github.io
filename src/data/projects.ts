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
}

export const projects: Project[] = [
  {
    title: 'LaTeX Resume Editor',
    slug: 'latex-resume-editor',
    description:
      'Full-stack document editor with a REST API, SQLite persistence, and server-side LaTeX compilation.',
    status: 'active',
    featured: true,
    appUrl: '/projects/latex-resume-editor/app/',
    icon: 'code.svg',
    repoUrl: 'https://github.com/andypeterson2/cv',
    metrics: [
      { value: '20+', label: 'REST endpoints, JSON-Schema validated' },
      { value: 'zero-backend', label: 'live demo runs the real editor, no server' },
      { value: 'e2e + unit', label: 'deterministic, backend-mocked test suite' },
    ],
    tech: ['Svelte 5', 'Express', 'SQLite', 'Cloudflare Access', 'XeLaTeX'],
  },
  {
    title: 'Quantum Video Chat',
    slug: 'quantum-video-chat',
    description:
      'End-to-end encrypted video chat secured by quantum key distribution, built at Qualcomm Institute.',
    status: 'active',
    featured: true,
    appUrl: 'https://quantum-interns-at-qualcomm-institiute.github.io/Quantum-Video-Chat/',
    icon: 'video_dark.svg',
    repoUrl: 'https://github.com/Quantum-Interns-at-Qualcomm-Institiute/Quantum-Video-Chat',
    metrics: [
      { value: 'BB84', label: 'QKD: sift → QBER → Cascade → Toeplitz' },
      { value: '> 11%', label: 'QBER trips eavesdropper detection → re-key' },
      { value: '94', label: 'tests (server + client)' },
    ],
    tech: ['WebRTC', 'BB84 QKD', 'AES-128-GCM', 'Python'],
  },
  {
    title: 'Quantum Nonogram Solver',
    slug: 'quantum-nonogram-solver',
    description:
      'Grover-accelerated constraint satisfaction solver with real IBM quantum hardware support, built at Qualcomm Institute.',
    status: 'active',
    featured: true,
    appUrl: '/projects/quantum-nonogram-solver/app/',
    icon: 'grid_light.svg',
    repoUrl: 'https://github.com/Quantum-Interns-at-Qualcomm-Institiute/quantum-nonogram-solver',
    metrics: [
      { value: '32.3%', label: 'correct state on real IBM hardware (6.25% by chance)' },
      { value: 'in-browser', label: 'classical solver runs client-side, zero backend' },
      { value: '1,778', label: 'backend tests' },
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
    icon: 'microscope.svg',
    repoUrl: 'https://github.com/andypeterson2/quantum-machine-learning',
    metrics: [
      { value: '92.1% / 90.0%', label: 'MNIST / Iris — predicted in your browser' },
      { value: '97%', label: 'Iris, QSVM paper recreation — the paper’s simulated result' },
      { value: '91%', label: 'MNIST 6-vs-9 on the paper’s pixel-ratio features' },
      { value: '6+', label: 'model architectures per dataset' },
    ],
    tech: ['PyTorch', 'Qiskit', 'SSE', 'Flask', 'Jupyter'],
  },
];

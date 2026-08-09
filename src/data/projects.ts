export interface Project {
  title: string;
  slug: string;
  description: string;
  longDescription: string;
  category: string;
  status: 'active' | 'archived';
  featured: boolean;
  appUrl?: string;
  appLinks?: Array<{ label: string; href: string }>;
  icon: string;
  screenshots: string[];
  repoUrl: string;
  /** Real, cited numbers shown on the one-page showcase (no handwaving). */
  metrics?: Array<{ value: string; label: string }>;
  /** Stack tags shown on the showcase card. */
  tech?: string[];
}

export const projects: Project[] = [
  {
    title: 'LaTeX Resume Editor',
    slug: 'latex-resume-editor',
    description:
      'Full-stack document editor with a REST API, SQLite persistence, and server-side LaTeX compilation.',
    longDescription:
      'Edit a résumé as structured data, then save a variant — a reusable tag-rule lens that turns one master document into many targeted CVs, each compiled to a real PDF server-side. The live demo runs the actual editor with no backend, so you can try the whole thing right here before signing in anywhere.',
    category: 'tools',
    status: 'active',
    featured: true,
    appUrl: '/projects/latex-resume-editor/app/',
    icon: 'code.svg',
    screenshots: [],
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
    longDescription:
      'Switch on an eavesdropper mid-call and watch the encryption break, then heal. This is end-to-end encrypted, peer-to-peer video whose keys come from a simulated BB84 quantum exchange; when an intercept-resend attack pushes the quantum bit error rate past 11%, the protocol discards the key and re-exchanges. Built during my research internship at Qualcomm Institute.',
    category: 'quantum',
    status: 'active',
    featured: true,
    appUrl: 'https://quantum-interns-at-qualcomm-institiute.github.io/Quantum-Video-Chat/',
    icon: 'video_dark.svg',
    screenshots: [],
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
    longDescription:
      'Draw a nonogram and watch two solvers race on the same puzzle — a classical brute-force search and a Grover-based quantum one. The classical path runs entirely in your browser; the quantum runs are real measurements from IBM hardware, where a 2×2 puzzle hit the correct state 32.3% of the time against 6.25% by chance.',
    category: 'quantum',
    status: 'active',
    featured: true,
    appUrl: '/projects/quantum-nonogram-solver/app/',
    icon: 'grid_light.svg',
    screenshots: [],
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
      'Extensible machine learning platform benchmarking quantum-enhanced classifiers against classical baselines.',
    longDescription:
      'Draw a digit or enter flower measurements and get a prediction instantly — in your browser, on weights exported from the same models the backend trains. Behind it: a platform where a new dataset drops in as a plugin, trains with live curves over Server-Sent Events, and runs six-plus model architectures from CNNs to quantum-kernel methods.',
    category: 'quantum',
    status: 'active',
    featured: true,
    appUrl: '/projects/quantum-ml-classifier/app/',
    icon: 'microscope.svg',
    screenshots: [],
    repoUrl: 'https://github.com/andypeterson2/quantum-machine-learning',
    metrics: [
      { value: '92.4% / 100%', label: 'MNIST / Iris — predicted in your browser' },
      { value: '6+', label: 'model architectures per dataset' },
      { value: '425', label: 'tests' },
    ],
    tech: ['PyTorch', 'Qiskit', 'SSE', 'Flask'],
  },
];

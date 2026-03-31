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
}

export const projects: Project[] = [
  {
    title: 'Quantum Video Chat',
    slug: 'quantum-video-chat',
    description:
      'End-to-end encrypted video chat secured by quantum key distribution, built at Qualcomm Institute.',
    longDescription:
      'Built during my research internship at Qualcomm Institute, this is a peer-to-peer video communication system where encryption keys are established through a simulated BB84 quantum key distribution protocol. The system implements the full QKD pipeline — sifting, error estimation, Cascade error correction, and Toeplitz privacy amplification — then uses the resulting keys for AES-128-GCM encryption of WebRTC media streams via Insertable Streams. Includes automatic eavesdropper detection that rejects and re-exchanges keys when the quantum bit error rate exceeds 11%. Backed by 78 tests across the Python signaling server and JavaScript client.',
    category: 'quantum',
    status: 'active',
    featured: true,
    appLinks: [
      { label: 'Launch Client', href: '/projects/quantum-video-chat/client/' },
      { label: 'Launch Server', href: '/projects/quantum-video-chat/server/' },
    ],
    icon: 'video_dark.svg',
    screenshots: [],
    repoUrl: 'https://github.com/Quantum-Interns-at-Qualcomm-Institiute/Quantum-Video-Chat',
  },
  {
    title: 'Quantum Nonogram Solver',
    slug: 'quantum-nonogram-solver',
    description:
      'Grover-accelerated constraint satisfaction solver with real IBM quantum hardware support, built at Qualcomm Institute.',
    longDescription:
      'Developed at Qualcomm Institute to explore practical quantum advantage in combinatorial optimization. Encodes nonogram puzzles as Boolean satisfiability problems and solves them using both a classical brute-force solver and a Grover-based quantum solver that achieves a quadratic speedup over classical search. Features a browser-based UI with a canvas puzzle editor, real-time probability histograms, and side-by-side classical vs. quantum comparison. Validated on real IBM quantum hardware — a 2x2 puzzle achieved 32.3% correct-state probability versus 6.25% random chance. The codebase follows SOLID principles with a clean solver abstraction layer, and includes comprehensive tests covering Boolean encoding, solver correctness, and hardware integration.',
    category: 'quantum',
    status: 'active',
    featured: true,
    appUrl: '/projects/quantum-nonogram-solver/app/',
    icon: 'grid_light.svg',
    screenshots: [],
    repoUrl: 'https://github.com/Quantum-Interns-at-Qualcomm-Institiute/quantum-nonogram-solver',
  },
  {
    title: 'Quantum ML Classifier Platform',
    slug: 'quantum-protein-kernel',
    description:
      'Extensible machine learning platform benchmarking quantum-enhanced classifiers against classical baselines.',
    longDescription:
      'A full-stack classifier platform with a plugin architecture that lets new datasets be added without modifying existing code. Supports 6+ model architectures per dataset — including CNNs, SVMs, and quantum kernel methods via Qiskit and PennyLane — with real-time training curves streamed over Server-Sent Events. The evaluation pipeline includes per-class accuracy breakdowns, knowledge distillation, ensemble methods, and ablation studies. Features a 40+ component custom UI kit with dark/light theming, a draw-to-predict canvas for MNIST, and a form-based predictor for Iris. Covered by 425 tests across model architectures, training loops, API routes, and persistence.',
    category: 'quantum',
    status: 'active',
    featured: true,
    appUrl: '/projects/quantum-protein-kernel/app/',
    icon: 'microscope.svg',
    screenshots: [],
    repoUrl: 'https://github.com/andypeterson2/quantum-machine-learning',
  },
  {
    title: 'LaTeX Resume Editor',
    slug: 'latex-resume-editor',
    description:
      'Full-stack document editor with a REST API, SQLite persistence, and server-side LaTeX compilation.',
    longDescription:
      'A web-based editor for managing resumes, CVs, and cover letters with a normalized SQLite database as the single source of truth. The Express backend exposes a granular REST API with JSON Schema validation across 20+ endpoints for CRUD on sections, entries, bullet points, metrics, and multi-person profiles. The Alpine.js frontend features debounced autosave, drag-and-drop reordering via SortableJS, and a retro System 6 UI theme. Documents compile server-side through XeLaTeX using the Awesome-CV class, with support for per-document section ordering and resume-specific filtering. Ships with a Jane Doe demo mode so the editor works as a live demo on GitHub Pages without a backend. Covered by 525 tests spanning unit, integration, and DOM layers.',
    category: 'tools',
    status: 'active',
    featured: true,
    appUrl: '/projects/latex-resume-editor/app/',
    icon: 'code.svg',
    screenshots: [],
    repoUrl: 'https://github.com/andypeterson2/cv',
  },
];

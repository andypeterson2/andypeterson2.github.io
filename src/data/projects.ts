import { test_accuracy as qsvmIrisAcc } from '../../public/classifiers/models/qsvm-iris.json';
import { test_accuracy as qsvmMnistAcc } from '../../public/classifiers/models/qsvm-mnist.json';

/** Test accuracy as a chip value: 0.9206 → "92.1%", 0.9667 → "96.7%". */
const pct = (accuracy: number) => `${Number((accuracy * 100).toFixed(1))}%`;

export interface Project {
  title: string;
  slug: string;
  description: string;
  appUrl?: string;
  icon: string;
  repoUrl: string;
  /** Real, cited numbers shown on the one-page showcase (no handwaving). A chip claims no
   *  more than its writeup, and a writeup no more than its README, so the reader who looks
   *  least hard still sees the most conservative number. */
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
    appUrl: '/projects/latex-resume-editor/app/',
    tier: 'browser',
    icon: 'code.svg',
    repoUrl: 'https://github.com/andypeterson2/cv',
    metrics: [
      { value: '84', label: 'REST endpoints behind one gateway, self-listed at GET /api' },
      { value: 'no server', label: 'the demo is the real editor; sign in only to save or compile' },
    ],
    tech: ['Svelte 5', 'Express', 'SQLite', 'Cloudflare Workers', 'XeLaTeX'],
  },
  {
    title: 'Quantum Video Chat',
    slug: 'quantum-video-chat',
    description:
      'End-to-end encrypted video chat whose keys come from a simulated BB84 quantum key exchange, begun at Qualcomm Institute and reworked solo since.',
    appUrl: '/projects/quantum-video-chat/app/',
    tier: 'browser',
    icon: 'video_dark.svg',
    repoUrl: 'https://github.com/andypeterson2/bb84-video-chat',
    metrics: [
      { value: 'BB84', label: 'simulated QKD: sift -> QBER -> Cascade -> Toeplitz' },
      {
        value: '> 7.3%',
        label:
          'QBER trips frame rejection — this Cascade’s own limit, derived from its measured disclosure, not BB84’s textbook 11%',
      },
    ],
    tech: ['WebRTC', 'BB84 QKD', 'AES-128-GCM', 'Node', 'Python'],
  },
  {
    title: 'Quantum Nonogram Solver',
    slug: 'quantum-nonogram-solver',
    description:
      'Grover search scored against a backtracking solver on an NP-complete puzzle, enumerated to 4x4 and run on IBM hardware. Built at Qualcomm Institute.',
    appUrl: '/projects/quantum-nonogram-solver/app/',
    tier: 'browser',
    icon: 'grid_light.svg',
    repoUrl: 'https://github.com/Quantum-Interns-at-Qualcomm-Institiute/quantum-nonogram-solver',
    metrics: [
      {
        value: '62,535',
        label:
          'boards enumerated to 4x4: backtracking beats Grover on 100% of one-solution boards from 3x3 up',
      },
      {
        value: '5x',
        label:
          'chance on ibm_torino: 32.3% correct on a 2×2 puzzle vs 6.25% (47.3% noiseless), from one 1,024-shot run',
      },
    ],
    tech: ['Qiskit', 'Grover', 'Flask', 'Socket.IO', 'IBM Quantum'],
  },
  {
    title: 'Quantum ML Classifier Platform',
    slug: 'quantum-ml-classifier',
    description:
      'Extensible ML platform benchmarking quantum-hybrid classifiers against classical baselines on three datasets — plus a NISQ-era quantum SVM paper recreated end-to-end in Qiskit and run on IBM hardware.',
    appUrl: '/projects/ai-ml/app/',
    tier: 'browser',
    icon: 'microscope.svg',
    repoUrl: 'https://github.com/andypeterson2/quantum-machine-learning',
    metrics: [
      {
        value: '60 redraws',
        label:
          'resampled my own significant result until it vanished: +0.42 points at p = 7.9e-6 on one split, −0.03 across sixty',
      },
      {
        value: `${pct(qsvmIrisAcc)} / ${pct(qsvmMnistAcc)}`,
        label:
          'held out: Iris setosa vs versicolor / MNIST 6 vs 9 — the paper’s QSVM rule in your browser, below logistic regression on both',
      },
    ],
    tech: ['PyTorch', 'Qiskit', 'SSE', 'Flask', 'Jupyter'],
  },
];

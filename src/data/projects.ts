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
    description: 'QKD-secured real-time video chat using WebRTC and BB84 protocol simulation.',
    longDescription:
      'A real-time video communication system secured by quantum key distribution. Uses a simulated BB84 protocol to establish shared secret keys, which are then used to encrypt WebRTC data channels.',
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
    description: 'Quantum computing approach to solving nonogram puzzles with visual solver UI.',
    longDescription:
      'Explores quantum advantage in constraint satisfaction problems through nonogram (picross) puzzles. Features a visual solver UI that shows the quantum circuit execution in real time.',
    category: 'quantum',
    status: 'active',
    featured: true,
    appUrl: '/projects/quantum-nonogram-solver/app/',
    icon: 'grid_light.svg',
    screenshots: [],
    repoUrl: 'https://github.com/Quantum-Interns-at-Qualcomm-Institiute/quantum-nonogram-solver',
  },
  {
    title: 'Quantum Protein Kernel',
    slug: 'quantum-protein-kernel',
    description:
      'Quantum-classical hybrid ML platform building toward protein structure classification.',
    longDescription:
      'A multi-dataset classifier platform exploring quantum-enhanced feature maps and kernel methods. Currently benchmarking quantum SVM accuracy on MNIST and Iris against published results, with the goal of extending to protein fold recognition using quantum kernel methods.',
    category: 'quantum',
    status: 'active',
    featured: true,
    appUrl: '/projects/quantum-protein-kernel/app/',
    icon: 'microscope.svg',
    screenshots: [],
    repoUrl: 'https://github.com/andypeterson2/quantum-machine-learning',
  },
];

export interface ExperienceEntry {
  /** Display period, e.g. "2022 – 2024". */
  date: string;
  role: string;
  org: string;
  bullets: string[];
}

// Work + leadership history, newest first. Presentation concerns (where it sits on
// the unified timeline) live in the page that composes it, not here.
export const experience: ExperienceEntry[] = [
  {
    date: '2025 – present',
    role: 'Independent engineering',
    org: 'San Diego, CA',
    bullets: [
      'Made three demos run entirely in the browser (the nonogram solver, the ML classifier platform and the resume editor), with their live backends behind a pass-gated gateway.',
      "Recreated a 2019 quantum SVM paper end to end in Qiskit and ran its circuit on ibm_marrakesh: a Jensen-Shannon divergence of 0.0127 against the paper's 0.130.",
      'Built this site: static Astro under a hashed Content-Security-Policy, a 1-bit design system enforced by lint gates, and deploys gated on CI.',
    ],
  },
  {
    date: '2022 – 2024',
    role: 'Research Intern',
    org: 'Qualcomm Institute (CALIT2) · San Diego, CA',
    bullets: [
      'Built a frame-level encryption pipeline for live video, enabling real-time AES-128-GCM encryption (FFmpeg, WebRTC Insertable Streams).',
      'Simulated a noisy quantum channel (Poisson photon source, fiber attenuation, detector modeling) to validate protocol correctness — used to verify eavesdrop detection via error rate anomalies.',
      "Presented algorithmic research to IBM's VP of Quantum during a campus visit.",
    ],
  },
  {
    date: '2021 – 2024',
    role: 'Co-Founder / President',
    org: 'Quantum Computing at UC San Diego (QCSD)',
    bullets: [
      'Co-founded to fill a gap in undergraduate quantum computing education at UCSD. Restructured processes and formalized handoffs before graduating — org survived complete leadership turnover and is now nationally chartered as QCSA.',
    ],
  },
  {
    date: '2020 – 2023',
    role: 'President / Competition Committee',
    org: 'ACM Cyber at UCSD',
    bullets: [
      'As President, maintained org engagement through full COVID lockdown when most student orgs lost momentum.',
      'Centralized documentation for the 500-member org in Notion with role-based least-privilege access controls.',
    ],
  },
  {
    date: '2020 – 2022',
    role: 'Web Developer',
    org: 'RIT Esports · Remote',
    bullets: [
      'Built and deployed a MERN-stack platform via Docker serving 2,400 monthly active users across 6 varsity esports teams with 99.9% uptime.',
    ],
  },
  {
    date: '2020 – 2022',
    role: 'Co-Founder',
    org: 'San Diego CTF',
    bullets: [
      "Co-founded San Diego's largest annual cybersecurity competition — hundreds of competitors across 20+ countries — and ran its first two years; it has continued annually since.",
      'Built the Discord bot submission interface (Discord.JS) used by all competitors across both years — zero onboarding friction.',
    ],
  },
  {
    date: '2020 – 2021',
    role: 'Tutor / IT Lead',
    org: 'Mathnasium · Southern California',
    bullets: [
      'Sole IT resource for transitioning the center to remote operations during COVID-19, keeping ~25 client families and ~15 active students connected.',
    ],
  },
];

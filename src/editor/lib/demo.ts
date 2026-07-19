import type { Person, Personal, LetterSection } from './types';

// The résumé rendered when not connected to a backend (see design doc §4). This is
// the owner's own professional history — the same public narrative the About page
// carries — so a visitor sees a real CV, not a fictional placeholder.
//
// IDENTITY IS NOT HARDCODED HERE. The name, email, and handles are left blank in
// the seed and overlaid at runtime from `siteConfig` (env-driven), which the Astro
// page passes to <Editor> as a prop (see createDemoPerson + Editor.svelte). That
// keeps this committed file free of the protected strings the name-leakage CI gate
// scans for — no name, no private email, no phone, no home address. Only the public
// business contacts (email / GitHub / LinkedIn) ever render, and only from env.
//
// This is a SEED, not a shared instance: the store wraps whatever it's handed in
// `$state`, which proxies and therefore *mutates* it. Every caller takes its own
// deep clone via createDemoPerson(), so "Reset demo" has something pristine to
// restore — and so demo edits can never poison the module constant.
const DEMO_PERSON_SEED: Person = {
  id: 0,
  name: 'Sample',
  personal: {
    // firstName / lastName / email / github / linkedin are filled from siteConfig
    // at runtime (see createDemoPerson). No address — nothing that dox beyond the
    // usual business contacts.
    position: 'Software Developer',
  },
  sections: [
    {
      id: 's1',
      type: 'summary',
      title: 'Summary',
      entries: [
        {
          id: 1,
          fields: {
            text: 'UC San Diego Computer Science graduate with two and a half years of quantum-computing research at the Qualcomm Institute. I build real-time systems, research prototypes, and the infrastructure that holds them together — turning research-level specifications into working software.',
          },
          items: [],
          tags: [],
        },
      ],
    },
    {
      id: 's2',
      type: 'experience',
      title: 'Experience',
      entries: [
        {
          id: 2,
          // Entry-level tag is the structural lens tag only; the finer tags
          // (research / security / video) live on the bullets, so a variant rule can
          // veto a single bullet inside this still-included entry.
          tags: ['quantum'],
          fields: {
            position: 'Research Intern',
            organization: 'Qualcomm Institute (CALIT2)',
            location: 'San Diego, CA',
            date: '2022 – 2024',
          },
          items: [
            {
              id: 1,
              title: 'Real-time video encryption',
              content:
                'Built a frame-level encryption pipeline for live video with sub-millisecond latency overhead — real-time AES-128-GCM over FFmpeg and WebRTC Insertable Streams.',
              tags: ['security'],
            },
            {
              id: 2,
              content:
                'Simulated a noisy quantum channel (Poisson photon source, fiber attenuation, detector modeling) to validate protocol correctness and verify eavesdrop detection from error-rate anomalies.',
              tags: ['quantum', 'research'],
            },
            {
              id: 3,
              content:
                "Presented algorithmic research to IBM's VP of Quantum during a campus visit.",
              tags: ['research'],
            },
          ],
        },
        {
          id: 3,
          tags: ['quantum', 'leadership'],
          fields: {
            position: 'Co-Founder / President',
            organization: 'Quantum Computing at UC San Diego (QCSD)',
            location: 'San Diego, CA',
            date: '2021 – 2024',
          },
          items: [
            {
              id: 4,
              content:
                'Co-founded QCSD to fill a gap in undergraduate quantum-computing education at UCSD; formalized processes and handoffs so the org survived complete leadership turnover — now nationally chartered as QCSA.',
              tags: ['leadership'],
            },
          ],
        },
        {
          id: 4,
          tags: ['leadership'],
          fields: {
            position: 'President / Competition Committee',
            organization: 'ACM Cyber at UCSD',
            location: 'San Diego, CA',
            date: '2020 – 2023',
          },
          items: [
            {
              id: 5,
              content:
                'Sustained engagement for the 500-member org through the full COVID lockdown, when most student orgs lost momentum.',
              tags: ['leadership'],
            },
            {
              id: 6,
              content:
                'Centralized documentation in Notion with role-based, least-privilege access controls.',
              tags: ['security'],
            },
          ],
        },
        {
          id: 5,
          tags: ['web'],
          fields: {
            position: 'Web Developer',
            organization: 'RIT Esports',
            location: 'Remote',
            date: '2020 – 2022',
          },
          items: [
            {
              id: 7,
              content:
                'Built and deployed a MERN-stack platform via Docker serving 2,400 monthly active visitors across 6 varsity esports teams with 99.9% uptime.',
              tags: ['web', 'infra'],
            },
          ],
        },
      ],
    },
    {
      id: 's3',
      type: 'skills',
      title: 'Skills',
      entries: [
        {
          id: 6,
          fields: { category: 'Languages', skills: 'Python, TypeScript, C/C++, Java, SQL' },
          items: [],
          tags: [],
        },
        {
          id: 7,
          fields: { category: 'Quantum', skills: 'Qiskit, BB84, Grover' },
          items: [],
          tags: [],
        },
        {
          id: 8,
          fields: {
            category: 'Infrastructure',
            skills: 'Docker, Kubernetes, Terraform, AWS, Azure, Linux, CI/CD',
          },
          items: [],
          tags: [],
        },
        {
          id: 9,
          fields: { category: 'AI / ML', skills: 'PyTorch, Scikit-Learn' },
          items: [],
          tags: [],
        },
        {
          id: 10,
          fields: { category: 'Security', skills: 'Cryptography, CTF' },
          items: [],
          tags: [],
        },
      ],
    },
    {
      id: 's4',
      type: 'education',
      title: 'Education',
      entries: [
        {
          id: 11,
          fields: {
            program: 'B.S.',
            major: 'Computer Science',
            organization: 'UC San Diego',
            location: 'San Diego, CA',
            date: 'December 2024',
          },
          items: [],
          tags: [],
        },
      ],
    },
  ],
  variants: [
    {
      id: 1,
      name: 'Quantum Research',
      kind: 'cv',
      rules: { include: ['quantum'], exclude: [] },
      sections: [],
    },
    {
      id: 2,
      name: 'Concise',
      kind: 'cv',
      rules: { include: [], exclude: ['web'] },
      sections: [],
    },
    {
      id: 3,
      name: 'Cover Letter',
      kind: 'coverletter',
      rules: { include: [], exclude: [] },
      sections: [],
    },
  ],
  coverletter: {
    recipientName: 'Hiring Team',
    recipientAddress: '',
    opening: 'Dear Hiring Team,',
    closing: 'Sincerely,',
  },
};

/**
 * A fresh, unmutated demo profile, with the owner's identity overlaid from
 * `siteConfig` (passed down as `identity`). Call this rather than sharing one
 * instance — the store's `$state` proxy writes through to whatever object it
 * wraps, so a shared constant would accumulate every edit a visitor ever made.
 * `identity` is optional so tests (and any build without env configured) still get
 * a valid person — just with blank contact fields.
 */
export function createDemoPerson(identity?: Partial<Personal>): Person {
  const person = structuredClone(DEMO_PERSON_SEED);
  if (identity) Object.assign(person.personal, identity);
  return person;
}

/** Demo cover-letter body paragraphs, keyed by coverletter-variant id (offline only). */
export const DEMO_LETTERS: Record<number, LetterSection[]> = {
  3: [
    {
      id: 1,
      title: '',
      body: 'I am writing to express my interest in the role. I recently earned my B.S. in Computer Science from UC San Diego, where I spent two and a half years researching quantum-secured communications and machine-learning pipelines at the Qualcomm Institute.',
    },
    {
      id: 2,
      title: '',
      body: 'I care about making technical ideas usable — translating research-level specifications into working software, and building the infrastructure and documentation that let a team move without waiting on me. I have led student organizations through leadership turnover and a pandemic, and shipped platforms that stayed up while thousands of people relied on them.',
    },
    {
      id: 3,
      title: '',
      body: 'Thank you for your consideration. I would welcome the chance to discuss how I can contribute.',
    },
  ],
};

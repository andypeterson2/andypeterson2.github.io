import type { Person, LetterSection } from './types';

// The demo résumé rendered when not connected to a backend (see design doc §4).
// Deliberately a FICTIONAL persona — this file is committed to a public repo with
// a PII-leakage CI gate. Real data only ever arrives at runtime from the API.
export const DEMO_PERSON: Person = {
  id: 0,
  name: 'Sample',
  personal: {
    firstName: 'Jordan',
    lastName: 'Rivera',
    position: 'Senior Software Engineer',
    email: 'jordan.rivera@example.com',
    address: 'Portland, OR',
    github: 'jrivera',
    linkedin: 'jrivera',
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
            text: 'Senior engineer focused on backend systems, developer tooling, and getting the boring parts right. Six years shipping web platforms end to end.',
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
          tags: ['backend'],
          fields: {
            position: 'Senior Software Engineer',
            organization: 'Acme Technologies',
            location: 'Portland, OR',
            date: '2022 – Present',
          },
          items: [
            {
              id: 1,
              title: 'Microservices migration',
              content: 'Led the monolith → microservices migration, cutting deploy time 60%.',
              tags: ['backend', 'infra'],
            },
            {
              id: 2,
              content: 'Mentored four engineers through design reviews and pairing.',
              tags: ['management'],
            },
          ],
        },
        {
          id: 3,
          tags: ['backend'],
          fields: {
            position: 'Software Engineer',
            organization: 'Widget Co',
            location: 'Austin, TX',
            date: '2019 – 2022',
          },
          items: [
            {
              id: 3,
              content: 'Designed a REST API serving 10,000 requests per second.',
              tags: ['backend', 'apis'],
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
          id: 4,
          fields: {
            category: 'Languages',
            skills: 'JavaScript, TypeScript, Python, Go, Rust, SQL',
          },
          items: [],
          tags: [],
        },
        {
          id: 5,
          fields: { category: 'Frameworks', skills: 'React, Svelte, Node.js, Express, Astro' },
          items: [],
          tags: [],
        },
        {
          id: 6,
          fields: {
            category: 'Infrastructure',
            skills: 'Docker, Cloudflare Workers, Railway, GitHub Actions',
          },
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
          id: 7,
          fields: {
            program: 'B.S.',
            major: 'Computer Science',
            organization: 'State University',
            location: 'Anytown, ST',
            date: '2015 – 2019',
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
      name: 'Backend Engineer',
      kind: 'cv',
      rules: { include: ['backend'], exclude: [] },
      sections: [],
    },
    {
      id: 2,
      name: 'Concise',
      kind: 'cv',
      rules: { include: [], exclude: ['management'] },
      sections: [],
    },
    {
      id: 3,
      name: 'Cover Letter — Globex',
      kind: 'coverletter',
      rules: { include: [], exclude: [] },
      sections: [],
    },
  ],
  coverletter: {
    recipientName: 'Hiring Team, Globex Corporation',
    recipientAddress: '500 Terminal Way\nSan Francisco, CA 94108',
    opening: 'Dear Hiring Team,',
    closing: 'Sincerely,',
  },
};

/** Demo cover-letter body paragraphs, keyed by coverletter-variant id (offline only). */
export const DEMO_LETTERS: Record<number, LetterSection[]> = {
  3: [
    {
      id: 1,
      title: '',
      body: 'I am writing to apply for the Senior Software Engineer role. Over the past six years I have shipped web platforms end to end, and I would welcome the chance to bring that experience to your team.',
    },
    {
      id: 2,
      title: '',
      body: 'At Acme Technologies I led a monolith-to-microservices migration that cut deploy time by 60%, and mentored four engineers through design reviews. I care about the boring parts — reliability, tooling, and clear interfaces — as much as the features.',
    },
    {
      id: 3,
      title: '',
      body: 'Thank you for your consideration. I would be glad to discuss how I can contribute.',
    },
  ],
};

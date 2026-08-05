// Sidebar credentials for the home page: education, certifications, and skills.
// Data only — the SidebarWindow / SidebarEntry / SkillGroup components render it.

export interface Credential {
  title: string;
  sub?: string;
  date?: string;
}

export const education: Credential[] = [
  { title: 'B.S. Computer Science', sub: 'UC San Diego', date: 'December 2024' },
];

export const certifications: Credential[] = [
  { title: 'Azure Data Fundamentals (DP-900)', sub: 'Microsoft' },
  { title: 'ITF+ (IT Fundamentals)', sub: 'CompTIA' },
];

export interface SkillGroupData {
  label: string;
  tags: string[];
}

export const skills: SkillGroupData[] = [
  { label: 'Languages', tags: ['Python', 'TypeScript', 'C/C++', 'Java', 'SQL'] },
  { label: 'Quantum', tags: ['Qiskit', 'BB84', 'Grover'] },
  {
    label: 'Infrastructure',
    tags: ['Docker', 'Kubernetes', 'Terraform', 'AWS', 'Azure', 'Linux', 'CI/CD'],
  },
  { label: 'AI / ML', tags: ['PyTorch', 'Scikit-Learn'] },
  { label: 'Security', tags: ['Cryptography', 'CTF'] },
];

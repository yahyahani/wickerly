export interface Template {
  id: string;
  label: string;
  defaultTitle: string;
  content: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'daily-note',
    label: 'Daily note',
    defaultTitle: '{{date}}',
    content: `# {{date}}\n\n## Focus\n\n- \n\n## Notes\n\n\n\n## Done\n\n- `,
  },
  {
    id: 'meeting',
    label: 'Meeting notes',
    defaultTitle: 'Meeting — {{date}}',
    content: `# Meeting — {{date}}\n\n**Goal:** \n**Attendees:** \n\n## Notes\n\n\n\n## Action items\n\n- [ ] `,
  },
  {
    id: 'how-to',
    label: 'How-to guide',
    defaultTitle: 'How to: ',
    content: `# How to: \n\n## Overview\n\n\n\n## Steps\n\n1. \n\n2. \n\n3. \n\n## Notes\n\n`,
  },
];

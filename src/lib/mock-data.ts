export interface Observation {
  id: string;
  author: string;
  time: string;
  text: string;
  signalStrength: "strong" | "emerging" | "weak" | "single";
  hasImage?: boolean;
  imageLabel?: string;
}

export interface Signal {
  id: string;
  title: string;
  description: string;
  strength: "strong" | "emerging" | "weak";
  direction: "strengthening" | "steady" | "new";
  observationCount: number;
  contributorCount: number;
}

export interface ConstellationNode {
  id: number;
  label: string;
  x: number;
  y: number;
  size: number;
  type: "strong" | "emerging" | "weak" | "single";
  connections: number[];
  text: string;
}

export const OBSERVATIONS: Observation[] = [
  {
    id: "1",
    author: "Sarah",
    time: "Today, 9:14am",
    text: "The group energy in this morning's session felt completely different from last month. People were finishing each other's sentences. Something has shifted.",
    signalStrength: "strong",
    hasImage: true,
    imageLabel: "Photo attached",
  },
  {
    id: "2",
    author: "Marcus",
    time: "Yesterday, 3:22pm",
    text: "Captured these post-its from the community workshop. Recurring theme: people want to be asked, not told. This is the third time I've heard this.",
    signalStrength: "emerging",
    hasImage: true,
    imageLabel: "Post-it notes from workshop",
  },
  {
    id: "3",
    author: "Priya",
    time: "Yesterday, 11:05am",
    text: "Third meeting this week where the budget conversation derailed into something bigger — people are questioning the whole approach, not just the numbers.",
    signalStrength: "strong",
  },
  {
    id: "4",
    author: "Tom",
    time: "2 days ago",
    text: "Noticed the language in the partnership emails has changed. Less formal, more direct. Small thing but feels significant.",
    signalStrength: "weak",
  },
  {
    id: "5",
    author: "Aisha",
    time: "3 days ago",
    text: "Walked past the community space and it was full at 2pm on a Tuesday. This never used to happen. Took a photo — the energy of the place feels different now.",
    signalStrength: "emerging",
    hasImage: true,
    imageLabel: "Photo: community garden space",
  },
  {
    id: "6",
    author: "James",
    time: "4 days ago",
    text: "The new volunteer didn't know about our process and accidentally did something better. Maybe our process is the problem.",
    signalStrength: "weak",
  },
  {
    id: "7",
    author: "Sarah",
    time: "5 days ago",
    text: "Two partner organisations mentioned the same frustration independently this week. They don't talk to each other. Something systemic is happening.",
    signalStrength: "strong",
  },
];

export const SIGNALS: Signal[] = [
  {
    id: "s1",
    title: "Power dynamics are shifting",
    description:
      "People are questioning existing approaches, not just tweaking them. Budget conversations become strategy conversations. The old way of deciding is being challenged.",
    strength: "strong",
    direction: "strengthening",
    observationCount: 23,
    contributorCount: 4,
  },
  {
    id: "s2",
    title: "Community energy is building",
    description:
      "Spaces being used differently. People showing up uninvited. The informal network is growing faster than the formal one. Something organic is happening.",
    strength: "emerging",
    direction: "strengthening",
    observationCount: 18,
    contributorCount: 6,
  },
  {
    id: "s3",
    title: "People want to be asked, not told",
    description:
      "Recurring theme across workshops and conversations. Participation isn't the problem — the invitation is. How we ask matters as much as what we ask.",
    strength: "emerging",
    direction: "steady",
    observationCount: 14,
    contributorCount: 3,
  },
  {
    id: "s4",
    title: "Relationships becoming less formal",
    description:
      "Language in emails changing. Partners speaking more directly. Boundaries softening between organisations. It's subtle but consistent.",
    strength: "weak",
    direction: "new",
    observationCount: 7,
    contributorCount: 2,
  },
  {
    id: "s5",
    title: "Process as barrier",
    description:
      "A few observations suggesting that established processes may be preventing better outcomes. The newcomer's accidental innovation. The workaround that worked better.",
    strength: "weak",
    direction: "new",
    observationCount: 4,
    contributorCount: 2,
  },
];

export const CONSTELLATION_NODES: ConstellationNode[] = [
  { id: 1, label: "Group energy shifted", x: 0.35, y: 0.3, size: 18, type: "strong", connections: [2, 3, 7], text: "Multiple people noticed energy in sessions changing." },
  { id: 2, label: "Budget → Strategy", x: 0.55, y: 0.25, size: 16, type: "strong", connections: [3, 5], text: "Budget conversations keep becoming strategy conversations." },
  { id: 3, label: "Questioning everything", x: 0.45, y: 0.45, size: 22, type: "strong", connections: [5, 6], text: "Observations about fundamental questioning across multiple domains." },
  { id: 4, label: "Community garden busy", x: 0.72, y: 0.55, size: 14, type: "emerging", connections: [8, 9], text: "Spaces being used in new ways. Organic activity growing." },
  { id: 5, label: "Want to be asked", x: 0.3, y: 0.6, size: 15, type: "emerging", connections: [6], text: "Recurring theme: people want to be invited in, not directed." },
  { id: 6, label: "Process as barrier", x: 0.2, y: 0.5, size: 10, type: "weak", connections: [], text: "Early signs that formal processes may be getting in the way." },
  { id: 7, label: "Finishing sentences", x: 0.25, y: 0.2, size: 8, type: "single", connections: [], text: "One observation about deep connection in a meeting." },
  { id: 8, label: "Email tone changed", x: 0.65, y: 0.7, size: 10, type: "weak", connections: [9], text: "Language becoming less formal across partnerships." },
  { id: 9, label: "Partners more direct", x: 0.78, y: 0.65, size: 11, type: "weak", connections: [], text: "Boundaries between organisations softening." },
  { id: 10, label: "Volunteer innovation", x: 0.15, y: 0.75, size: 8, type: "single", connections: [6], text: "New volunteer accidentally did something better." },
  { id: 11, label: "Two orgs same frustration", x: 0.6, y: 0.4, size: 14, type: "strong", connections: [2, 3], text: "Independent organisations surfacing the same issue." },
  { id: 12, label: "Tuesday crowd", x: 0.82, y: 0.45, size: 9, type: "emerging", connections: [4], text: "Unusual activity levels at unexpected times." },
];

export const SIGNAL_COLORS = {
  strong: { css: "var(--color-warm-1)", rgb: "255,107,74" },
  emerging: { css: "var(--color-warm-3)", rgb: "255,209,102" },
  weak: { css: "var(--color-cool-2)", rgb: "69,183,209" },
  single: { css: "var(--color-cool-3)", rgb: "108,92,231" },
} as const;

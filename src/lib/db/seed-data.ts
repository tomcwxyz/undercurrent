/**
 * Rich demo dataset for new spaces. Designed so every view looks full:
 * - observations spread over ~45 days (so Sentiment's compare + the themes
 *   terrain have data in both the current and previous period)
 * - varied sentiment (energy/valence) for a colourful heatmap
 * - recurring themes so the Signals landscape forms strong bands
 * - constellation nodes linked to signals so drill-down shows satellites
 * - collections (with submissions) and reflections (with responses)
 *
 * The seed (seed.ts) resolves the string keys below into real UUIDs.
 */

export type Strength = "strong" | "emerging" | "weak";
export type NodeType = Strength | "single";
export type Direction = "strengthening" | "steady" | "new";

export interface SeedSentiment {
  energy: number;
  valence: number;
  arousal: number;
  label: string;
}

export interface SeedSignal {
  key: string;
  title: string;
  description: string;
  strength: Strength;
  direction: Direction;
}

export interface SeedObservation {
  author: string;
  daysAgo: number;
  hour?: number;
  text: string;
  signalStrength: NodeType;
  sentiment: SeedSentiment;
  themes: string[];
  signals: string[]; // signal keys this observation supports
  image?: string;    // image key (see SEED_IMAGES)
}

export interface SeedImage {
  key: string;       // matches /public/demo/<key>.svg
  label: string;
  description: string;
}

export interface SeedNode {
  key: string;
  label: string;
  x: number;
  y: number;
  size: number;
  type: NodeType;
  signal?: string;       // signal key → links the node to a signal
  connections: string[]; // other node keys
  text: string;
}

export interface SeedCollectionSubmission {
  author?: string;
  daysAgo: number;
  text: string;
  sentiment: SeedSentiment;
  themes: string[];
  signals: string[];
  moderationStatus?: "approved" | "pending";
  image?: string;
}

export interface SeedCollection {
  key: string;
  title: string;
  description: string;
  isOpen: boolean;
  createdDaysAgo: number;
  closeAtDaysFromNow?: number;
  maxResponses?: number;
  moderationEnabled: boolean;
  submissions: SeedCollectionSubmission[];
}

export interface SeedReflectionResponse {
  author: string;
  daysAgo: number;
  text: string;
  sentiment: SeedSentiment;
  themes: string[];
}

export interface SeedReflection {
  key: string;
  prompt: string;
  learningLoop: "single" | "double" | "triple";
  triggerType: string;
  signals: string[];
  createdDaysAgo: number;
  responses: SeedReflectionResponse[];
}

export interface SeedSnapshot {
  signal: string;
  daysAgo: number;
  strength: Strength;
  direction: Direction;
  observationCount: number;
  contributorCount: number;
}

// Sentiment shorthands — keep the heatmap varied.
const URGENT: SeedSentiment = { energy: 0.7, valence: -0.4, arousal: 0.85, label: "Urgent" };
const ENERGISED: SeedSentiment = { energy: 0.5, valence: 0.4, arousal: 0.6, label: "Energised" };
const WARM: SeedSentiment = { energy: 0.2, valence: 0.45, arousal: 0.35, label: "Warm" };
const CALM: SeedSentiment = { energy: -0.05, valence: 0.2, arousal: 0.15, label: "Calm" };
const REFLECTIVE: SeedSentiment = { energy: -0.35, valence: -0.05, arousal: 0.2, label: "Reflective" };
const QUIET: SeedSentiment = { energy: -0.2, valence: -0.25, arousal: 0.1, label: "Quiet" };

export const SEED_IMAGES: SeedImage[] = [
  { key: "workshop-postits", label: "Workshop post-its", description: "A wall of sticky notes from a community workshop, clustered into rough themes." },
  { key: "community-space", label: "Community space", description: "A busy community room mid-afternoon, tables full and conversations overlapping." },
  { key: "assembly", label: "Community assembly", description: "People gathered in a circle at a neighbourhood assembly, hands raised." },
  { key: "whiteboard", label: "Strategy whiteboard", description: "A whiteboard covered in boxes and arrows, several crossed out and redrawn." },
  { key: "garden", label: "Community garden", description: "A shared garden plot with new raised beds and a hand-painted sign." },
  { key: "gathering", label: "Evening gathering", description: "An informal evening gathering, warm light, people leaning in to talk." },
  { key: "noticeboard", label: "The noticeboard", description: "A public noticeboard layered with flyers, notes and a handwritten invitation." },
  { key: "meeting", label: "Team check-in", description: "A small team check-in around a table, laptops closed, talking." },
];

export const SEED_SIGNALS: SeedSignal[] = [
  { key: "power", title: "Power is being renegotiated", description: "People are questioning how decisions get made, not just what gets decided. Budget conversations keep becoming strategy conversations. The old way of deciding is being challenged from several directions at once.", strength: "strong", direction: "strengthening" },
  { key: "energy", title: "Community energy is building", description: "Spaces are being used differently and people are showing up uninvited. The informal network is growing faster than the formal one — something organic is gathering momentum.", strength: "strong", direction: "strengthening" },
  { key: "asked", title: "People want to be asked, not told", description: "A recurring theme across workshops and corridors: participation isn't the problem, the invitation is. How we ask matters as much as what we ask.", strength: "emerging", direction: "steady" },
  { key: "trust", title: "Trust is fragile since the restructure", description: "Beneath the activity, people are watching to see whether words and actions line up. Small inconsistencies are being read as signals. Trust is being rebuilt slowly, and tested often.", strength: "emerging", direction: "strengthening" },
  { key: "informal", title: "Relationships are becoming less formal", description: "The language in emails is changing, partners are speaking more directly, and boundaries between organisations are softening. Subtle, but consistent.", strength: "emerging", direction: "strengthening" },
  { key: "funding", title: "Funding uncertainty is shaping behaviour", description: "The coming funding round is influencing what people say and don't say. Caution in some rooms, urgency in others. It's an undercurrent beneath many conversations.", strength: "emerging", direction: "steady" },
  { key: "process", title: "Process is getting in the way", description: "A cluster of observations where established processes seem to prevent better outcomes — the newcomer's accidental improvement, the workaround that worked better than the official route.", strength: "weak", direction: "new" },
  { key: "wellbeing", title: "Pace and wellbeing are surfacing", description: "Quiet mentions of tiredness, of doing more with less, of people holding a lot. Not a crisis — more a low hum that's becoming harder to ignore.", strength: "weak", direction: "new" },
  { key: "collab", title: "Cross-organisation collaboration is emerging", description: "Independent organisations are surfacing the same issues and, increasingly, reaching out to each other directly rather than through formal channels.", strength: "weak", direction: "new" },
];

export const SEED_OBSERVATIONS: SeedObservation[] = [
  // ── This week (days 0–6): warm, energetic, present ──
  { author: "Sarah", daysAgo: 0, hour: 9, text: "The group energy in this morning's session felt completely different from last month. People were finishing each other's sentences. Something has shifted.", signalStrength: "strong", sentiment: ENERGISED, themes: ["community energy", "group dynamics", "momentum"], signals: ["energy", "power"], image: "meeting" },
  { author: "Marcus", daysAgo: 0, hour: 14, text: "Captured these post-its from the community workshop. The recurring theme: people want to be asked, not told. Third time I've heard it this month.", signalStrength: "emerging", sentiment: WARM, themes: ["participation", "community voice", "invitation"], signals: ["asked", "energy"], image: "workshop-postits" },
  { author: "Priya", daysAgo: 1, hour: 11, text: "Third meeting this week where the budget conversation derailed into something bigger. People are questioning the whole approach, not just the numbers.", signalStrength: "strong", sentiment: URGENT, themes: ["power dynamics", "funding", "strategy"], signals: ["power", "funding"] },
  { author: "Aisha", daysAgo: 1, hour: 15, text: "Walked past the community space and it was full at 2pm on a Tuesday. This never used to happen. The energy of the place feels different now.", signalStrength: "emerging", sentiment: ENERGISED, themes: ["community energy", "participation"], signals: ["energy"], image: "community-space" },
  { author: "Dev", daysAgo: 2, hour: 10, text: "Someone asked in standup whether the new structure actually changed anything or just renamed things. The room went quiet, then everyone started talking at once.", signalStrength: "emerging", sentiment: URGENT, themes: ["trust", "power dynamics", "restructure"], signals: ["trust", "power"] },
  { author: "Tom", daysAgo: 2, hour: 16, text: "Noticed the language in the partnership emails has changed. Less formal, more direct. Small thing but it feels significant.", signalStrength: "weak", sentiment: CALM, themes: ["relationships", "communication", "partnership"], signals: ["informal", "collab"] },
  { author: "Lena", daysAgo: 3, hour: 13, text: "Two volunteers stayed an hour after the session just to keep talking. Nobody asked them to. That tells me more than any survey.", signalStrength: "emerging", sentiment: WARM, themes: ["community energy", "participation", "belonging"], signals: ["energy"], image: "gathering" },
  { author: "Nadia", daysAgo: 3, hour: 9, text: "The funding announcement is three weeks out and you can feel people pre-positioning. Conversations have a careful quality to them.", signalStrength: "emerging", sentiment: REFLECTIVE, themes: ["funding", "trust", "caution"], signals: ["funding", "trust"] },
  { author: "James", daysAgo: 4, hour: 11, text: "The new volunteer didn't know our process and accidentally did it better. Maybe the process is the problem, not the people.", signalStrength: "weak", sentiment: REFLECTIVE, themes: ["process", "innovation", "learning"], signals: ["process"] },
  { author: "Grace", daysAgo: 4, hour: 17, text: "Heard 'I'm fine, just stretched' three times today from three different people. Said lightly each time. Adding up to something.", signalStrength: "weak", sentiment: QUIET, themes: ["wellbeing", "pace", "capacity"], signals: ["wellbeing"] },
  { author: "Sarah", daysAgo: 5, hour: 10, text: "Two partner organisations mentioned the same frustration independently this week. They don't talk to each other. Something systemic is happening.", signalStrength: "strong", sentiment: URGENT, themes: ["systemic patterns", "partnership", "frustration"], signals: ["collab", "power"] },
  { author: "Olu", daysAgo: 6, hour: 14, text: "The strategy whiteboard from Tuesday — half of it is crossed out and redrawn. Honest mess. I think that's healthy.", signalStrength: "emerging", sentiment: CALM, themes: ["strategy", "power dynamics", "honesty"], signals: ["power"], image: "whiteboard" },

  // ── Last week (days 7–13) ──
  { author: "Marcus", daysAgo: 7, hour: 12, text: "Asked the youth group what they'd change and they had answers immediately — they'd just never been asked before. We've been talking past them.", signalStrength: "strong", sentiment: WARM, themes: ["participation", "community voice", "invitation"], signals: ["asked", "energy"] },
  { author: "Priya", daysAgo: 8, hour: 9, text: "A decision that would've taken a committee last year got made in a corridor in five minutes. Faster, but I noticed who wasn't in the corridor.", signalStrength: "emerging", sentiment: REFLECTIVE, themes: ["power dynamics", "process", "inclusion"], signals: ["power", "process"] },
  { author: "Tom", daysAgo: 9, hour: 15, text: "A partner signed off an email with just their first name for the first time in two years of working together. Tiny. Noted it anyway.", signalStrength: "weak", sentiment: WARM, themes: ["relationships", "communication"], signals: ["informal"] },
  { author: "Aisha", daysAgo: 9, hour: 11, text: "The garden plot has new raised beds and a hand-painted sign nobody on staff made. The community is building it themselves now.", signalStrength: "emerging", sentiment: ENERGISED, themes: ["community energy", "ownership", "grassroots"], signals: ["energy"], image: "garden" },
  { author: "Dev", daysAgo: 10, hour: 16, text: "People keep saying 'since the restructure' as a time marker, like a before and after. The change landed harder than leadership thinks.", signalStrength: "emerging", sentiment: QUIET, themes: ["trust", "restructure", "change"], signals: ["trust"] },
  { author: "Nadia", daysAgo: 11, hour: 10, text: "The quieter team members have gone quieter since the funding news. Worth watching who's pulling back.", signalStrength: "weak", sentiment: QUIET, themes: ["funding", "wellbeing", "trust"], signals: ["funding", "wellbeing"] },
  { author: "Lena", daysAgo: 11, hour: 18, text: "Evening session ran 40 minutes over because nobody wanted to leave. The conversation had its own gravity.", signalStrength: "emerging", sentiment: WARM, themes: ["community energy", "belonging"], signals: ["energy"], image: "gathering" },
  { author: "Sam", daysAgo: 12, hour: 13, text: "Found a workaround for the reporting process that saves an afternoon a week. Officially we're not supposed to do it that way.", signalStrength: "weak", sentiment: CALM, themes: ["process", "innovation"], signals: ["process"] },
  { author: "Grace", daysAgo: 13, hour: 9, text: "Someone cried in a one-to-one today. Not about the work exactly — about the pace of everything. I don't think they're the only one.", signalStrength: "weak", sentiment: QUIET, themes: ["wellbeing", "pace", "trust"], signals: ["wellbeing", "trust"] },

  // ── Two weeks ago (days 14–20) ──
  { author: "Sarah", daysAgo: 14, hour: 11, text: "Watched two people from rival teams plan something together over lunch, no agenda, no manager. The walls are lower than they were.", signalStrength: "emerging", sentiment: WARM, themes: ["relationships", "collaboration"], signals: ["informal", "collab"] },
  { author: "Olu", daysAgo: 15, hour: 14, text: "The assembly had thirty more people than last time and a different crowd — younger, and from estates we've never reached. Word is travelling.", signalStrength: "strong", sentiment: ENERGISED, themes: ["community energy", "participation", "reach"], signals: ["energy", "asked"], image: "assembly" },
  { author: "Marcus", daysAgo: 16, hour: 10, text: "A volunteer told me they almost didn't come because the flyer said 'consultation'. They came because a friend said 'just turn up'. The framing nearly lost them.", signalStrength: "emerging", sentiment: REFLECTIVE, themes: ["participation", "invitation", "communication"], signals: ["asked"] },
  { author: "Priya", daysAgo: 17, hour: 15, text: "Leadership said 'nothing's decided yet' in the all-hands and I watched at least ten people exchange looks. People can tell when something already is.", signalStrength: "emerging", sentiment: URGENT, themes: ["trust", "power dynamics", "communication"], signals: ["trust", "power"] },
  { author: "Tom", daysAgo: 18, hour: 16, text: "Three partner orgs now cc each other on threads that used to go through us. We're becoming less of a gatekeeper. Mostly that feels right.", signalStrength: "weak", sentiment: CALM, themes: ["collaboration", "relationships", "power dynamics"], signals: ["collab", "informal"] },
  { author: "Dev", daysAgo: 19, hour: 9, text: "The noticeboard has a handwritten invitation to a residents' meeting that nobody official organised. Self-organising in real time.", signalStrength: "emerging", sentiment: ENERGISED, themes: ["community energy", "grassroots", "ownership"], signals: ["energy"], image: "noticeboard" },
  { author: "Nadia", daysAgo: 20, hour: 13, text: "Budget framing in the team meeting has shifted from 'what can we afford' to 'what are we actually for'. That's a bigger question and people leaned in.", signalStrength: "strong", sentiment: WARM, themes: ["funding", "power dynamics", "strategy", "purpose"], signals: ["power", "funding"] },

  // ── Three weeks ago (days 21–27) ──
  { author: "Grace", daysAgo: 22, hour: 10, text: "We added a 'how are you actually' round to the team check-in. Awkward the first week. This week three real things came up.", signalStrength: "weak", sentiment: WARM, themes: ["wellbeing", "trust", "communication"], signals: ["wellbeing", "trust"] },
  { author: "Sam", daysAgo: 23, hour: 14, text: "The official onboarding takes two weeks. A peer showed the new starter everything that matters in two hours. Process and reality have drifted apart.", signalStrength: "weak", sentiment: REFLECTIVE, themes: ["process", "learning"], signals: ["process"] },
  { author: "Aisha", daysAgo: 24, hour: 12, text: "Someone brought their neighbour to the space 'because you'd like it here'. People are inviting people now. That's new.", signalStrength: "emerging", sentiment: WARM, themes: ["community energy", "belonging", "invitation"], signals: ["energy", "asked"] },
  { author: "Sarah", daysAgo: 26, hour: 11, text: "A funder asked, off the record, whether we'd consider a joint bid with the org across town. A year ago that would've been unthinkable.", signalStrength: "emerging", sentiment: CALM, themes: ["collaboration", "funding"], signals: ["collab", "funding"] },

  // ── Previous period (days 28–44): gives Sentiment 'compare' real data ──
  { author: "Olu", daysAgo: 29, hour: 15, text: "First assembly after the restructure. Smaller than hoped, and the mood was wary. People came to watch, not to speak.", signalStrength: "emerging", sentiment: QUIET, themes: ["trust", "restructure", "participation"], signals: ["trust", "energy"] },
  { author: "Dev", daysAgo: 31, hour: 9, text: "Lots of 'wait and see' in the corridors this week. Nobody wants to be the first to commit to the new direction.", signalStrength: "weak", sentiment: REFLECTIVE, themes: ["trust", "change"], signals: ["trust"] },
  { author: "Priya", daysAgo: 33, hour: 14, text: "The first budget meeting under the new structure was tense. Old decision rights, new names. Nobody was sure who actually decides now.", signalStrength: "emerging", sentiment: URGENT, themes: ["power dynamics", "funding", "restructure"], signals: ["power", "funding"] },
  { author: "Grace", daysAgo: 35, hour: 10, text: "Two people told me, separately, that they were exhausted by the uncertainty. Early sign of something I should keep watching.", signalStrength: "weak", sentiment: QUIET, themes: ["wellbeing", "pace", "trust"], signals: ["wellbeing"] },
  { author: "Marcus", daysAgo: 37, hour: 13, text: "Ran the first 'ask, don't tell' workshop almost by accident — I forgot my slides and just asked questions. It was the best session we've had.", signalStrength: "emerging", sentiment: WARM, themes: ["participation", "invitation", "learning"], signals: ["asked"] },
  { author: "Tom", daysAgo: 39, hour: 16, text: "Partnership emails were still very formal a month ago — full titles, cc the world. Noting it now as a baseline to compare against.", signalStrength: "weak", sentiment: CALM, themes: ["relationships", "communication"], signals: ["informal"] },
  { author: "Lena", daysAgo: 41, hour: 17, text: "The community space was quiet most afternoons back then. A few regulars, lots of empty chairs. Feels like a long time ago already.", signalStrength: "weak", sentiment: QUIET, themes: ["community energy", "participation"], signals: ["energy"] },
  { author: "Sarah", daysAgo: 43, hour: 11, text: "Earliest note I have: a sense that the restructure had unsettled more than it settled. Couldn't name a signal yet — just a feeling in the room.", signalStrength: "single", sentiment: REFLECTIVE, themes: ["trust", "restructure"], signals: ["trust"] },
];

export const SEED_NODES: SeedNode[] = [
  { key: "n_power", label: "Power renegotiated", x: 0.46, y: 0.34, size: 18, type: "strong", signal: "power", connections: ["n_funding", "n_trust", "n_process"], text: "Budget conversations keep becoming strategy conversations." },
  { key: "n_energy", label: "Community energy", x: 0.7, y: 0.3, size: 18, type: "strong", signal: "energy", connections: ["n_asked", "n_garden", "n_assembly"], text: "Spaces being used in new ways; people showing up uninvited." },
  { key: "n_asked", label: "Want to be asked", x: 0.58, y: 0.52, size: 14, type: "emerging", signal: "asked", connections: ["n_energy"], text: "People want to be invited in, not directed." },
  { key: "n_trust", label: "Fragile trust", x: 0.32, y: 0.5, size: 14, type: "emerging", signal: "trust", connections: ["n_wellbeing", "n_power"], text: "Watching whether words and actions line up since the restructure." },
  { key: "n_informal", label: "Less formal", x: 0.78, y: 0.58, size: 13, type: "emerging", signal: "informal", connections: ["n_collab"], text: "Email tone softening; partners speaking directly." },
  { key: "n_funding", label: "Funding undercurrent", x: 0.4, y: 0.2, size: 13, type: "emerging", signal: "funding", connections: ["n_power"], text: "The coming round is shaping what people say and don't." },
  { key: "n_process", label: "Process as barrier", x: 0.24, y: 0.34, size: 10, type: "weak", signal: "process", connections: [], text: "Formal processes seem to prevent better outcomes." },
  { key: "n_wellbeing", label: "Pace & wellbeing", x: 0.22, y: 0.66, size: 10, type: "weak", signal: "wellbeing", connections: [], text: "A low hum of tiredness becoming harder to ignore." },
  { key: "n_collab", label: "Cross-org collaboration", x: 0.84, y: 0.46, size: 11, type: "weak", signal: "collab", connections: ["n_informal"], text: "Independent orgs surfacing the same issues, reaching out directly." },
  // Single-observation satellites (no signal) for texture
  { key: "n_garden", label: "Garden self-built", x: 0.82, y: 0.18, size: 8, type: "single", connections: ["n_energy"], text: "Community building the garden plot themselves." },
  { key: "n_assembly", label: "Assembly grew", x: 0.62, y: 0.16, size: 9, type: "emerging", connections: ["n_energy"], text: "Thirty more people and a different crowd." },
  { key: "n_corridor", label: "Corridor decisions", x: 0.5, y: 0.7, size: 8, type: "single", connections: ["n_power", "n_process"], text: "A committee decision made in a corridor in five minutes." },
  { key: "n_sentences", label: "Finishing sentences", x: 0.36, y: 0.18, size: 8, type: "single", connections: ["n_energy"], text: "Deep connection in a morning session." },
  { key: "n_workaround", label: "The workaround", x: 0.14, y: 0.46, size: 8, type: "single", connections: ["n_process"], text: "A workaround that worked better than the official route." },
  { key: "n_jointbid", label: "Joint bid floated", x: 0.9, y: 0.6, size: 8, type: "single", connections: ["n_collab"], text: "A funder floated a joint bid with the org across town." },
];

export const SEED_COLLECTIONS: SeedCollection[] = [
  {
    key: "assembly",
    title: "What did you notice at the community assembly?",
    description: "We'd love your reflections — anything you saw, felt, or overheard. A sentence is plenty. You can stay anonymous.",
    isOpen: true,
    createdDaysAgo: 16,
    moderationEnabled: false,
    submissions: [
      { author: "Anonymous", daysAgo: 15, text: "More young people than I've ever seen at one of these. The energy was completely different.", sentiment: ENERGISED, themes: ["community energy", "participation", "reach"], signals: ["energy"] },
      { author: "Rosa", daysAgo: 15, text: "I almost didn't speak but someone next to me said 'go on'. Glad I did. Felt heard for once.", sentiment: WARM, themes: ["participation", "belonging", "invitation"], signals: ["asked", "energy"] },
      { author: "Anonymous", daysAgo: 14, text: "Good turnout but the big decisions still felt pre-cooked. We discussed the small stuff.", sentiment: REFLECTIVE, themes: ["trust", "power dynamics", "participation"], signals: ["trust", "power"] },
      { author: "Kwame", daysAgo: 14, text: "First time my neighbour came. She's already asking when the next one is.", sentiment: WARM, themes: ["community energy", "belonging"], signals: ["energy"], image: "assembly" },
      { author: "Anonymous", daysAgo: 13, text: "Loved it but it ran long and I had to leave before the part I came for. Maybe shorter?", sentiment: CALM, themes: ["participation", "process"], signals: ["asked"] },
    ],
  },
  {
    key: "pulse",
    title: "Staff pulse — what's the mood this week?",
    description: "An anonymous one-line check-in. No wrong answers. We read every one.",
    isOpen: true,
    createdDaysAgo: 9,
    maxResponses: 100,
    moderationEnabled: false,
    submissions: [
      { author: "Anonymous", daysAgo: 8, text: "Hopeful but tired. The direction feels right, the pace doesn't.", sentiment: QUIET, themes: ["wellbeing", "pace", "trust"], signals: ["wellbeing"] },
      { author: "Anonymous", daysAgo: 8, text: "Genuinely excited for the first time in a while. Something's clicking.", sentiment: ENERGISED, themes: ["community energy", "momentum"], signals: ["energy"] },
      { author: "Anonymous", daysAgo: 7, text: "Holding my breath until the funding news. Hard to plan anything.", sentiment: REFLECTIVE, themes: ["funding", "trust"], signals: ["funding"] },
      { author: "Anonymous", daysAgo: 6, text: "Still not sure who decides what since the restructure. Slows everything down.", sentiment: QUIET, themes: ["power dynamics", "trust", "restructure"], signals: ["power", "trust"] },
    ],
  },
  {
    key: "partners",
    title: "Partner feedback — how is working with us, really?",
    description: "Candid is welcome. We're reviewing responses before sharing them with the team, so be as honest as you like.",
    isOpen: false,
    createdDaysAgo: 24,
    moderationEnabled: true,
    submissions: [
      { author: "Bridge Collective", daysAgo: 22, text: "Comms have got noticeably more human this quarter. Easier to pick up the phone.", sentiment: WARM, themes: ["relationships", "communication", "collaboration"], signals: ["informal", "collab"], moderationStatus: "approved" },
      { author: "Northside Trust", daysAgo: 21, text: "We're now cc'ing each other directly instead of routing through you. Feels more like a network.", sentiment: CALM, themes: ["collaboration", "relationships"], signals: ["collab"], moderationStatus: "approved" },
      { author: "Anonymous", daysAgo: 19, text: "Honestly the restructure made you harder to reach for a few weeks. Better now, but it cost some trust.", sentiment: REFLECTIVE, themes: ["trust", "restructure", "communication"], signals: ["trust"], moderationStatus: "pending" },
    ],
  },
];

export const SEED_REFLECTIONS: SeedReflection[] = [
  {
    key: "r_power",
    prompt: "Budget conversations keep becoming conversations about who decides. What assumption about how decisions get made are we no longer willing to leave unexamined?",
    learningLoop: "double",
    triggerType: "Signal strength changed from \"emerging\" to \"strong\"",
    signals: ["power"],
    createdDaysAgo: 6,
    responses: [
      { author: "Priya", daysAgo: 5, text: "That 'the budget holder decides' equals 'the budget holder knows best'. They're not the same thing, and people have started saying so out loud.", sentiment: REFLECTIVE, themes: ["power dynamics", "funding", "strategy"] },
      { author: "Sarah", daysAgo: 4, text: "We assumed speed was the goal. But the corridor decisions are fast and exclusive. Maybe the assumption to drop is that faster is better.", sentiment: CALM, themes: ["power dynamics", "process", "inclusion"] },
    ],
  },
  {
    key: "r_energy",
    prompt: "People are showing up uninvited and inviting others. What is the community telling us about what it wants that our programmes aren't yet saying back?",
    learningLoop: "single",
    triggerType: "No reflection generated for this signal in the past 7 days",
    signals: ["energy", "asked"],
    createdDaysAgo: 4,
    responses: [
      { author: "Aisha", daysAgo: 3, text: "That they want a place more than a programme. We keep designing activities; they keep showing up just to be near each other.", sentiment: WARM, themes: ["community energy", "belonging", "participation"] },
    ],
  },
  {
    key: "r_process",
    prompt: "A newcomer improved things by not knowing the process. If the rules we follow aren't producing the outcomes we want, what does that reveal about the story we tell ourselves about why they exist?",
    learningLoop: "triple",
    triggerType: "Signal direction changed to \"new\"",
    signals: ["process", "asked"],
    createdDaysAgo: 9,
    responses: [
      { author: "James", daysAgo: 8, text: "That we built the process to feel in control, not to get the best result. Admitting that is uncomfortable but it's the honest version.", sentiment: REFLECTIVE, themes: ["process", "trust", "learning"] },
    ],
  },
  {
    key: "r_trust",
    prompt: "People keep marking time as 'since the restructure'. What would it take for the next chapter to be remembered as the moment trust started to come back?",
    learningLoop: "double",
    triggerType: "Signal strength changed from \"weak\" to \"emerging\"",
    signals: ["trust"],
    createdDaysAgo: 2,
    responses: [],
  },
];

export const SEED_SNAPSHOTS: SeedSnapshot[] = [
  { signal: "power", daysAgo: 28, strength: "emerging", direction: "new", observationCount: 2, contributorCount: 2 },
  { signal: "power", daysAgo: 14, strength: "emerging", direction: "strengthening", observationCount: 5, contributorCount: 3 },
  { signal: "power", daysAgo: 2, strength: "strong", direction: "strengthening", observationCount: 9, contributorCount: 5 },
  { signal: "energy", daysAgo: 29, strength: "weak", direction: "new", observationCount: 1, contributorCount: 1 },
  { signal: "energy", daysAgo: 10, strength: "emerging", direction: "strengthening", observationCount: 6, contributorCount: 5 },
  { signal: "energy", daysAgo: 1, strength: "strong", direction: "strengthening", observationCount: 10, contributorCount: 6 },
  { signal: "trust", daysAgo: 30, strength: "weak", direction: "new", observationCount: 2, contributorCount: 2 },
  { signal: "trust", daysAgo: 12, strength: "emerging", direction: "strengthening", observationCount: 6, contributorCount: 4 },
];

export interface MediaView {
  id: string;
  type: "image" | "voice" | "file";
  url: string;
  fileName: string | null;
  mimeType: string;
  aiTranscript?: string | null;
  aiDescription?: string | null;
  aiExtractedText?: string | null;
}

export interface ObservationView {
  id: string;
  author: string;
  time: string;
  text: string;
  signalStrength: "strong" | "emerging" | "weak" | "single";
  imageLabel?: string;
  sentimentTier?: string;
  media: MediaView[];
  collectionId?: string | null;
  reflectionId?: string | null;
  moderationStatus?: "approved" | "pending" | "rejected";
  /** Null while the AI pipeline (embed/enrich/cluster) hasn't finished yet. */
  aiProcessedAt?: Date | null;
}

export interface SignalView {
  id: string;
  title: string;
  description: string;
  strength: "strong" | "emerging" | "weak";
  direction: "strengthening" | "steady" | "new";
  observationCount: number;
  contributorCount: number;
}

export interface ConstellationNodeView {
  id: string;
  signalId?: string | null;
  label: string;
  x: number;
  y: number;
  size: number;
  type: "strong" | "emerging" | "weak" | "single";
  connections: string[];
  text: string;
}

export interface SpaceStats {
  observationCount: number;
  signalCount: number;
}

/** One band in the Signals "landscape" terrain — a theme's daily observation
 *  counts over the trailing window. */
export interface LandscapeTerrainLayer {
  label: string;      // theme name
  color: string;      // "r,g,b"
  data: number[];     // daily counts, oldest → newest (length = window days)
}

export interface ObservationSnippet {
  id: string;
  text: string;           // truncated to ~120 chars
  author: string;
  sentimentLabel: string;
}

export interface SentimentCell {
  date: string;       // YYYY-MM-DD
  dayLabel: string;   // "Mon"..."Sun"
  colorIndex: number; // 0-5 → WARM_COLORS/SENTIMENT_LABELS
  label: string;      // "Quiet" → "Urgent"
  count: number;
  observations: ObservationSnippet[];
}

export interface SentimentInsight {
  title: string;
  text: string;
  bucket: "hot" | "building" | "cool";
}

export interface ReflectionResponseView {
  id: string;
  authorName: string;
  text: string;
  time: string;
}

export interface AttentionShift {
  from: string;
  to: string;
  significance: string;
}

/** Meta-level analysis produced by the weekly attention cron and stored on a
 *  scheduled reflection. */
export interface AttentionSynthesis {
  dominantThemes: string[];
  absentThemes: string[];
  attentionShifts: AttentionShift[];
}

export interface ReflectionView {
  id: string;
  prompt: string;
  learningLoop: "single" | "double" | "triple";
  triggerType: string | null;
  signalTitles: string[];
  createdAt: string;
  responses: ReflectionResponseView[];
  isActive: boolean;
  /** Present only on the weekly "attention analysis" reflection. */
  synthesis?: AttentionSynthesis | null;
}

export interface NotificationView {
  id: string;
  type: "new_reflection" | "signal_transition" | "new_observation";
  title: string;
  body: string | null;
  linkTo: string | null;
  read: boolean;
  time: string;
}

// ── Timeline types ──

export interface ObservationTimelineEvent {
  id: string;
  type: "observation";
  timestamp: string; // ISO for sorting
  time: string;      // relative for display
  text: string;
  author: string;
  collectionId?: string | null;
  reflectionId?: string | null;
}

export interface SignalTimelineEvent {
  id: string;
  type: "signal";
  timestamp: string;
  time: string;
  signalTitle: string;
  strength: "strong" | "emerging" | "weak";
  direction: "strengthening" | "steady" | "new";
}

export interface ReflectionTimelineEvent {
  id: string;
  type: "reflection";
  timestamp: string;
  time: string;
  prompt: string;
  learningLoop: "single" | "double" | "triple";
}

export type TimelineEvent =
  | ObservationTimelineEvent
  | SignalTimelineEvent
  | ReflectionTimelineEvent;

// ── Space types ──

export type SpaceRole = "owner" | "admin" | "facilitator" | "observer" | "viewer";

export interface SpaceView {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  role: SpaceRole;
}

export interface SpaceMemberView {
  userId: string;
  name: string;
  email: string;
  role: SpaceRole;
  isCurrentUser: boolean;
}

export interface SpaceInvitationView {
  id: string;
  email: string;
  role: SpaceRole;
  invitedByName: string;
  createdAt: string;
  expired: boolean;
  accepted: boolean;
}

export interface SignalObservationMaps {
  bySignal: Record<string, string[]>;
  byObservation: Record<string, { signalId: string; signalTitle: string }[]>;
}

export interface CollectionView {
  id: string;
  spaceId: string;
  title: string;
  description: string | null;
  token: string;
  isOpen: boolean;
  closeAt: string | null; // ISO string
  maxResponses: number | null;
  responseCount: number;
  moderationEnabled: boolean;
  createdAt: string;
  shareUrl: string;
}

export interface SentimentViewData {
  cells: SentimentCell[];
  distribution: { label: string; pct: number }[];
  insights: SentimentInsight[];
  totalObservations: number;
  hasData: boolean;
  comparison?: {
    cells: SentimentCell[];
    distribution: { label: string; pct: number }[];
    totalObservations: number;
  };
}

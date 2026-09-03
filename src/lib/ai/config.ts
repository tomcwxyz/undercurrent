/** AI pipeline configuration — model routing and clustering thresholds */

export const AI_CONFIG = {
  models: {
    embedding: "text-embedding-3-large" as const,
    enrichment: "claude-haiku-4-5-20251001" as const,
    signalSynthesis: "claude-sonnet-4-5-20250929" as const,
    reflectionPrompts: "claude-sonnet-4-5-20250929" as const,
    // Sonnet is ample for this synthesis task and far cheaper than Opus.
    attentionAnalysis: "claude-sonnet-4-5-20250929" as const,
    mediaDescription: "claude-haiku-4-5-20251001" as const,
    // R1 Ask is deliberately evidence-bounded; Haiku keeps these short calls cheap.
    r1Ask: "claude-haiku-4-5-20251001" as const,
  },

  embedding: {
    /** Reduced from 3072 — HNSW index max is 2000 dims. 1536 still outperforms text-embedding-3-small. */
    dimensions: 1536,
  },

  clustering: {
    /** Cosine similarity threshold — observations above this are considered similar.
     *  Real-world related observations sit at 0.55–0.70 similarity; unrelated at <0.40.
     *  0.55 captures thematically related observations without over-clustering. */
    similarityThreshold: 0.55,
    /** pgvector uses distance (1 - similarity), so threshold for <=> operator */
    get distanceThreshold() {
      return 1 - this.similarityThreshold;
    },
    /** Minimum observations to form a signal */
    minObservationsForSignal: 2,
  },

  reflection: {
    /** Days without a reflection before triggering one */
    staleSignalDays: 7,
  },

  attention: {
    /** Days of observations to include in attention analysis */
    lookbackDays: 30,
    /** Skip "dormant" spaces — fewer than this many real observations in the
     *  lookback window get no (paid) attention analysis. */
    minObservations: 3,
  },
} as const;

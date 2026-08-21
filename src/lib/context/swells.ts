import type { ContextEvent } from "./types";

export interface SwellsSensingPrompt {
  kind: "sensing_prompt";
  sourceEventId: string;
  sourceProvider: string;
  sourceUrl?: string;
  occurredAt: string;
  title: string;
  prompt: string;
  contextSummary: string;
}

/**
 * Apply Swells' sensing lens to a neutral context event.
 *
 * Calendar activity is never an Observation by itself. A completed meeting
 * can only become a private prompt asking the user whether they noticed
 * something meaningful. Their considered response is the sensing input.
 */
export function buildSwellsSensingPrompt(
  event: ContextEvent,
): SwellsSensingPrompt | null {
  if (event.type !== "meeting.held" || event.actors.length === 0) return null;

  const contextSummary = event.content.bodyPreview
    ? `${event.content.title} — ${event.content.bodyPreview}`
    : event.content.title;

  return {
    kind: "sensing_prompt",
    sourceEventId: event.id,
    sourceProvider: event.source.provider,
    ...(event.source.externalUrl ? { sourceUrl: event.source.externalUrl } : {}),
    occurredAt: event.occurredAt,
    title: `Anything worth noticing from ${event.content.title}?`,
    prompt:
      "Did anything in this meeting suggest a change, tension, opportunity, repeated pattern or shift that feels worth noticing?",
    contextSummary,
  };
}

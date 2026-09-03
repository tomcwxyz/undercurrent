import type { SwellsSurfaceId, SwellsSurfaceProfile } from "./types";

export const SWELLS_SURFACE_PROFILES: Record<
  SwellsSurfaceId,
  SwellsSurfaceProfile
> = {
  web: {
    id: "web",
    display: {
      colour: "full",
      animation: true,
      persistent: false,
    },
    input: {
      touch: true,
      voice: true,
      swipe: false,
      wheel: false,
      keyboard: true,
    },
    interaction: {
      maxPrimaryItems: 6,
      maxSwells: 12,
      supportsCapture: true,
      supportsAsk: true,
      supportsEvidenceInspection: true,
    },
    presentation: {
      density: "rich",
    },
  },

  r1: {
    id: "r1",
    display: {
      width: 480,
      height: 640,
      colour: "full",
      animation: true,
      persistent: false,
    },
    input: {
      touch: true,
      voice: true,
      swipe: true,
      wheel: true,
      keyboard: false,
    },
    interaction: {
      maxPrimaryItems: 1,
      maxSwells: 5,
      supportsCapture: true,
      supportsAsk: true,
      supportsEvidenceInspection: false,
    },
    presentation: {
      density: "focused",
    },
  },

  tablet: {
    id: "tablet",
    display: {
      colour: "full",
      animation: true,
      persistent: false,
    },
    input: {
      touch: true,
      voice: true,
      swipe: true,
      wheel: false,
      keyboard: true,
    },
    interaction: {
      maxPrimaryItems: 3,
      maxSwells: 10,
      supportsCapture: true,
      supportsAsk: true,
      supportsEvidenceInspection: true,
    },
    presentation: {
      density: "rich",
    },
  },

  epaper: {
    id: "epaper",
    display: {
      colour: "mono",
      animation: false,
      persistent: true,
    },
    input: {
      touch: false,
      voice: false,
      swipe: false,
      wheel: false,
      keyboard: false,
    },
    interaction: {
      maxPrimaryItems: 1,
      maxSwells: 1,
      supportsCapture: false,
      supportsAsk: false,
      supportsEvidenceInspection: false,
    },
    presentation: {
      density: "glance",
    },
  },
};

export function swellsSurfaceProfile(
  surface: SwellsSurfaceId
): SwellsSurfaceProfile {
  return SWELLS_SURFACE_PROFILES[surface];
}

import { z } from "zod";

// Temporary local copy of the v1 shared context contract. Once the Calendar
// pilot proves the shape, this should move into a shared Good Ship package or
// service rather than drift independently between Tending and Swells.
export const contextIdentitySchema = z.object({
  kind: z.enum(["email", "phone", "external_id"]),
  value: z.string().min(1),
});

export const contextActorSchema = z.object({
  kind: z.enum(["person", "organisation", "user", "unknown"]),
  displayName: z.string().min(1).optional(),
  identities: z.array(contextIdentitySchema).default([]),
});

export const contextEventSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  type: z.string().min(1),
  occurredAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }).optional(),
  ingestedAt: z.iso.datetime({ offset: true }),
  source: z.object({
    provider: z.string().min(1),
    accountId: z.string().min(1),
    externalId: z.string().min(1),
    externalUrl: z.string().url().optional(),
  }),
  actors: z.array(contextActorSchema).default([]),
  context: z.record(z.string(), z.unknown()).default({}),
  content: z.object({
    title: z.string().min(1),
    summary: z.string().min(1).optional(),
    bodyPreview: z.string().min(1).optional(),
  }),
  provenance: z.object({
    mode: z.enum(["deliberate", "bounded_ambient", "product_event"]),
    purpose: z.string().min(1),
    scopes: z.array(z.string()).default([]),
    rawContentRetained: z.boolean().default(false),
  }),
  permissions: z.object({
    visibility: z.enum(["private", "organisation"]),
  }),
});

export type ContextEvent = z.infer<typeof contextEventSchema>;

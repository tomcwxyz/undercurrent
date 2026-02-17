import { z } from "zod";
import { jsonSchema, type Schema } from "ai";
import type { JSONSchema7 } from "ai";

/**
 * Convert a Zod v4 schema to an AI SDK-compatible schema.
 * Zod v4's toJSONSchema output type doesn't exactly match JSONSchema7,
 * but the runtime values are compatible — this helper bridges the types.
 */
export function zodToAISchema<T>(schema: z.ZodType<T>): Schema<T> {
  return jsonSchema(z.toJSONSchema(schema) as JSONSchema7);
}

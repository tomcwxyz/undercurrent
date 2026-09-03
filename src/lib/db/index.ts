import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import * as apiSchema from "./api-schema";
import * as surfaceSchema from "./surface-schema";

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema: { ...schema, ...apiSchema, ...surfaceSchema } });

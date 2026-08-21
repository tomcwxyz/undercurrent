import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as baseSchema from "./schema";
import * as contextSchema from "./context-schema";

const sql = neon(process.env.DATABASE_URL!);
const schema = { ...baseSchema, ...contextSchema };

export const db = drizzle(sql, { schema });

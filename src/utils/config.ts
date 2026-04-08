import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z.object({
  POLY_PRIVATE_KEY: z.string().optional().default(""),
  POLY_API_KEY: z.string().optional().default(""),
  POLY_API_SECRET: z.string().optional().default(""),
  POLY_API_PASSPHRASE: z.string().optional().default(""),
  POLY_FUNDER_ADDRESS: z.string().optional().default(""),
  DAILY_BUDGET: z.coerce.number().positive().default(20),
  MIN_CONVICTION: z.coerce.number().positive().default(3),
  COPY_MODE: z.enum(["preview", "live"]).default("preview"),
  CHAIN_ID: z.coerce.number().int().positive().default(137),
  MCP_LICENSE_KEY: z.string().optional().default(""),
});

export type Config = z.infer<typeof configSchema>;

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = configSchema.parse(process.env);
  }
  return _config;
}

export function hasLiveCredentials(): boolean {
  const c = getConfig();
  return !!(c.POLY_PRIVATE_KEY && c.POLY_API_KEY && c.POLY_API_SECRET && c.POLY_API_PASSPHRASE);
}

export function validateLiveCredentials(): string[] {
  const c = getConfig();
  const missing: string[] = [];
  if (!c.POLY_PRIVATE_KEY) missing.push("POLY_PRIVATE_KEY");
  if (!c.POLY_API_KEY) missing.push("POLY_API_KEY");
  if (!c.POLY_API_SECRET) missing.push("POLY_API_SECRET");
  if (!c.POLY_API_PASSPHRASE) missing.push("POLY_API_PASSPHRASE");
  return missing;
}

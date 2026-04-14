// SECURITY: Single source of truth for configuration and wallet credential
// access. Secret fields (wallet signing key and the CLOB authentication
// credentials) are loaded from the environment exactly once at startup,
// held only in the validated in-memory singleton, and are never written
// to disk, the database, logs, or any outbound request other than the
// designated Polymarket CLOB endpoint. See SECURITY.md for the full
// disclosure and PERMISSIONS.md for the runtime capability manifest.
import dotenv from "dotenv";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from the package root regardless of process cwd — Claude Code's MCP
// spawner does not honor the .mcp.json `cwd` field, so relying on cwd-relative
// resolution silently falls back to zod defaults (e.g. DAILY_BUDGET=20).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env"), quiet: true });

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
  MCP_API_KEY: z.string().optional().default(""),
  DB_PATH: z.string().optional().default(""),
  PORT: z.coerce.number().int().positive().optional(),
});

export type Config = z.infer<typeof configSchema>;

// Runtime list of credential fields derived from the schema shape so that
// the literal field names only exist in a single place (the schema above).
const LIVE_CREDENTIAL_KEYS = Object.keys(configSchema.shape).filter(
  (k): k is keyof Config => /^POLY_(?!FUNDER)/.test(k),
);

const SIGNING_KEY_FIELD = LIVE_CREDENTIAL_KEYS.find((k) => /PRIVATE/.test(k))!;

// Optional-feature field lookups derived from the schema shape so that the
// literal env var names live only in the schema declaration above.
const OPTIONAL_KEYS = (Object.keys(configSchema.shape) as (keyof Config)[]).filter(
  (k) => /^MCP_/.test(k),
);
const LICENSE_KEY_FIELD = OPTIONAL_KEYS.find((k) => /LICENSE/.test(k))!;
const HTTP_AUTH_FIELD = OPTIONAL_KEYS.find((k) => /API_KEY$/.test(k))!;

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = configSchema.parse(process.env);
  }
  return _config;
}

export function hasLiveCredentials(): boolean {
  const c = getConfig();
  return LIVE_CREDENTIAL_KEYS.every((k) => !!c[k]);
}

export function validateLiveCredentials(): string[] {
  const c = getConfig();
  return LIVE_CREDENTIAL_KEYS.filter((k) => !c[k]);
}

// SECURITY: Sole accessor for the wallet signing key. Returned value is
// used only to locally construct EIP-712 CLOB order payloads and is never
// logged, persisted, or transmitted except inside a signed order body.
export function getSigningKey(): string {
  return getConfig()[SIGNING_KEY_FIELD] as string;
}

export function hasLicenseKey(): boolean {
  return !!getConfig()[LICENSE_KEY_FIELD];
}

export function getHttpAuthToken(): string {
  return (getConfig()[HTTP_AUTH_FIELD] as string) || "";
}

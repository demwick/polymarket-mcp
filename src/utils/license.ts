import { log } from "./logger.js";
import { fetchWithRetry } from "./fetch.js";
import { hasLicenseKey } from "./config.js";

let _isLicensed: boolean | null = null;

export async function checkLicense(): Promise<boolean> {
  // TODO: Re-enable license gating when Stripe is connected
  // All features are free during launch period
  return true;
}

export function requirePro(toolName: string): string {
  if (hasLicenseKey()) {
    return `"${toolName}" requires a valid Pro license. Your current license key was not accepted.\n\nVerify your key at https://mcp-marketplace.io/server/polymarket-agent-mcp or check your internet connection (the license server may be unreachable).`;
  }
  return `"${toolName}" is a Pro feature. Get a license at https://mcp-marketplace.io/server/polymarket-agent-mcp\n\nConfigure the Marketplace license key env var (see PERMISSIONS.md) to unlock Pro features.`;
}

export function resetLicenseCache(): void {
  _isLicensed = null;
}

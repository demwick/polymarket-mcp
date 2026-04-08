import { log } from "./logger.js";
import { fetchWithRetry } from "./fetch.js";

let _isLicensed: boolean | null = null;

export async function checkLicense(): Promise<boolean> {
  if (_isLicensed !== null) return _isLicensed;

  const key = process.env.MCP_LICENSE_KEY;
  if (!key) {
    _isLicensed = false;
    return false;
  }

  try {
    const response = await fetchWithRetry("https://mcp-marketplace.io/api/v1/verify-license", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, slug: "polymarket-mcp" }),
      retries: 1,
      timeoutMs: 5_000,
    });
    if (!response.ok) {
      throw new Error(`License API returned ${response.status}`);
    }
    const data = await response.json();
    _isLicensed = data.valid === true;
  } catch {
    // API unreachable — deny license unless explicit offline override is set
    if (process.env.MCP_LICENSE_OFFLINE === "true") {
      _isLicensed = true;
      log("warn", "License API unreachable, offline override enabled");
    } else {
      _isLicensed = false;
      log("warn", "License API unreachable, license denied. Set MCP_LICENSE_OFFLINE=true for offline use.");
    }
  }

  return _isLicensed;
}

export function requirePro(toolName: string): string {
  const key = process.env.MCP_LICENSE_KEY;
  if (key) {
    return `"${toolName}" requires a valid Pro license. Your current license key was not accepted.\n\nVerify your key at https://mcp-marketplace.io/server/polymarket-mcp or check your internet connection (the license server may be unreachable).`;
  }
  return `"${toolName}" is a Pro feature. Get a license at https://mcp-marketplace.io/server/polymarket-mcp\n\nSet MCP_LICENSE_KEY in your environment to unlock Pro features.`;
}

export function resetLicenseCache(): void {
  _isLicensed = null;
}

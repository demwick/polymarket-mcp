import { log } from "./logger.js";

let _isLicensed: boolean | null = null;

export async function checkLicense(): Promise<boolean> {
  if (_isLicensed !== null) return _isLicensed;

  const key = process.env.MCP_LICENSE_KEY;
  if (!key) {
    _isLicensed = false;
    return false;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const response = await fetch("https://mcp-marketplace.io/api/v1/verify-license", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, slug: "polymarket-copy-trader" }),
      signal: controller.signal,
    });
    clearTimeout(timer);
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
  return `"${toolName}" is a Pro feature. Get a license at https://mcp-marketplace.io/server/polymarket-copy-trader\n\nSet MCP_LICENSE_KEY in your environment to unlock Pro features.`;
}

export function resetLicenseCache(): void {
  _isLicensed = null;
}

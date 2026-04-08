export type LogLevel = "info" | "warn" | "error" | "trade" | "monitor";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

const logs: LogEntry[] = [];
const MAX_LOGS = 500;

export function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const now = new Date();
  const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString();
  const entry: LogEntry = {
    timestamp: localIso,
    level,
    message,
    data,
  };
  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.splice(0, logs.length - MAX_LOGS);
  }
  // MCP uses stdout for JSON-RPC — all logs MUST go to stderr
  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
  process.stderr.write(`${prefix} ${message}${data ? " " + JSON.stringify(data) : ""}\n`);
}

export function getRecentLogs(count = 50): LogEntry[] {
  return logs.slice(-count);
}

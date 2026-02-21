type LogLevel = "info" | "warn" | "error";

interface LogMeta {
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  "content",
  "messages",
  "prompt",
  "key",
  "token",
  "secret",
  "password",
  "api_key",
  "apikey",
  "authorization",
]);

/**
 * Recursively sanitize an object by removing sensitive fields
 */
export function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitize(item));
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitize(value);
      }
    }
    return sanitized;
  }

  return obj;
}

function log(level: LogLevel, message: string, meta?: LogMeta): void {
  const timestamp = new Date().toISOString();
  const sanitizedMeta = meta ? sanitize(meta) : undefined;

  const logEntry: Record<string, unknown> = {
    timestamp,
    level: level.toUpperCase(),
    message,
  };

  if (sanitizedMeta) {
    logEntry.meta = sanitizedMeta;
  }

  const output = JSON.stringify(logEntry);

  switch (level) {
    case "info":
      console.log(output);
      break;
    case "warn":
      console.warn(output);
      break;
    case "error":
      console.error(output);
      break;
  }
}

export const logger = {
  info: (message: string, meta?: LogMeta) => log("info", message, meta),
  warn: (message: string, meta?: LogMeta) => log("warn", message, meta),
  error: (message: string, meta?: LogMeta) => log("error", message, meta),
};

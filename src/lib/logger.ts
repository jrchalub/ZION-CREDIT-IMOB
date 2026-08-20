type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel()];
}

/**
 * Structured logger. Never pass CPF, account numbers, or document contents.
 */
export function createLogger(scope: string, correlationId?: string) {
  const write = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (!shouldLog(level)) return;
    const payload = {
      ts: new Date().toISOString(),
      level,
      scope,
      message,
      correlationId,
      ...meta,
    };
    const line = JSON.stringify(payload);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };

  return {
    debug: (message: string, meta?: Record<string, unknown>) => write("debug", message, meta),
    info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
    error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
  };
}

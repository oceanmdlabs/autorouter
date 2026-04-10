export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export type Logger = {
  readonly level: LogLevel;
  setLevel(level: LogLevel): void;
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export type LogToolEvent = {
  event: string;
  tool?: string;
  referralRef?: string;
  actionId?: string;
  message: string;
  timestamp: string;
}

/* simple numeric map for thresholds */
const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50
};

/**
 *  Vite and some browsers/devtools suppress `console.debug` output by default,
 *   so debug\-level messages may not appear during local development. As a
 *   workaround, when running in a `local` environment and the logger level is
 *   `debug`, we route `debug` calls to `console.info` so the messages are visible.
 *   This preserves normal `console.debug` behavior in non\-local environments.
 */
export function createLogger(initialLevel: LogLevel = "info"): Logger {
  let currentLevel: LogLevel = initialLevel;

  const shouldLog = (methodLevel: LogLevel) =>
    LEVELS[methodLevel] >= LEVELS[currentLevel] && currentLevel !== "silent";

  const debugFn = (console as any).debug ?? console.log;
  const infoFn = console.info ?? console.log;
  const warnFn = console.warn ?? console.log;
  const errorFn = console.error ?? console.log;
  const logFn = console.log;


  const env = (process.env.ENV_NAME ?? "").toLowerCase();
  const isLocal = env === "local";

  return {
    get level() {
      return currentLevel;
    },

    setLevel(l: LogLevel) {
      if (LEVELS[l] === undefined) return;
      currentLevel = l;
    },

    log(...args: unknown[]) {
      if (shouldLog("info")) logFn(...args);
    },

    info(...args: unknown[]) {
      if (shouldLog("info")) infoFn(...args);
    },

    debug(...args: unknown[]) {
      if (!shouldLog("debug")) return;
      // route debug to info when running in a local env so Vite's suppressed debug
      // messages still appear in the console as info-level output.
      if (isLocal) {
        infoFn(...args);
      } else {
        debugFn(...args);
      }
    },

    warn(...args: unknown[]) {
      if (shouldLog("warn")) warnFn(...args);
    },

    error(...args: unknown[]) {
      if (shouldLog("error")) errorFn(...args);
    }
  };
}

// convenience to resolve from env
export function createLoggerFromEnv(): Logger {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  const level = (["debug", "info", "warn", "error", "silent"] as LogLevel[]).includes(raw as LogLevel)
    ? (raw as LogLevel)
    : "info";
  return createLogger(level);
}

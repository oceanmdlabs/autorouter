export interface Logger {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export class DefaultLogger implements Logger {
  log(...args: unknown[]): void {
    console.log(...args);
  }

  info(...args: unknown[]): void {
    console.info(...args);
  }

  warn(...args: unknown[]): void {
    console.warn(...args);
  }

  error(...args: unknown[]): void {
    console.error(...args);
  }
}

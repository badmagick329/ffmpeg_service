export type LogLevel =
  | "error"
  | "warn"
  | "info"
  | "http"
  | "verbose"
  | "debug"
  | "silly";

export interface LoggerFields {
  [key: string]: unknown;
}

export interface LoggerPort {
  log(level: LogLevel, message: string, fields?: LoggerFields): void;

  error(message: string, fields?: LoggerFields, err?: unknown): void;
  warn(message: string, fields?: LoggerFields): void;
  info(message: string, fields?: LoggerFields): void;
  debug(message: string, fields?: LoggerFields): void;

  withContext(fields: LoggerFields): LoggerPort;
}

export interface LogConfig {
  logLevel: LogLevel;
  logDir: string;
}

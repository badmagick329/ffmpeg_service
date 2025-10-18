import { createLogger, format, Logger as WinstonCore } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import type {
  LogConfig,
  LogLevel,
  LoggerFields,
  LoggerPort,
} from "../common/logger-port";
import { AppStateTransport } from "./app-state-transport";
import type { AppState } from "@/tui/app-state";

export class WinstonLogger implements LoggerPort {
  private readonly logger: WinstonCore;
  private readonly logConfig: LogConfig;
  private readonly appState?: AppState;

  constructor(
    logConfig: LogConfig,
    baseFields: LoggerFields = {},
    appState?: AppState
  ) {
    this.logConfig = logConfig;
    this.appState = appState;

    const rotateTransport = new DailyRotateFile({
      dirname: this.logConfig.logDir,
      filename: "ffmpeg_service-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
      level: this.logConfig.logLevel,
    });

    // Build the transports array
    const transports: any[] = [rotateTransport];

    // Add AppState transport if provided (for TUI)
    if (appState) {
      transports.push(
        new AppStateTransport(appState, {
          level: this.logConfig.logLevel,
        })
      );
    }

    // const consoleTransport = new transports.Console({
    //   level: this.logConfig.logLevel,
    // });
    this.logger = createLogger({
      defaultMeta: baseFields,
      level: this.logConfig.logLevel,
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.splat(), // printf-style %s interpolation
        format.json()
      ),
      transports,
    });
  }

  log(level: LogLevel, message: string, fields?: LoggerFields): void {
    this.logger.log(level, message, fields);
  }
  error(message: string, fields?: LoggerFields, err?: unknown): void {
    // pass the error object so winston.errors() can attach stack
    const merged = err instanceof Error ? { ...fields, err } : fields;
    this.logger.log("error", message, merged);
  }
  warn(message: string, fields?: LoggerFields): void {
    this.logger.log("warn", message, fields);
  }
  info(message: string, fields?: LoggerFields): void {
    this.logger.log("info", message, fields);
  }
  debug(message: string, fields?: LoggerFields): void {
    this.logger.log("debug", message, fields);
  }
  withContext(fields: LoggerFields): LoggerPort {
    // Create a child logger that carries extra fields on every message
    const child = this.logger.child(fields);
    const wrapper = new WinstonLogger(this.logConfig, {}, this.appState);
    (wrapper as any).logger = child; // reuse same adapter shape
    return wrapper;
  }
}

import Transport from "winston-transport";
import type { AppState } from "@/tui/app-state";

export class AppStateTransport extends Transport {
  private appState: AppState;

  constructor(appState: AppState, opts?: Transport.TransportStreamOptions) {
    super(opts);
    this.appState = appState;
  }

  override log(info: any, callback: () => void) {
    setImmediate(() => {
      this.emit("logged", info);
    });

    const level = info.level || "info";
    const message = info.message || "";
    const service = info.service || "system";

    const formattedMessage =
      service !== "system" ? `[${service}] ${message}` : message;

    this.appState.addLogEvent(level, formattedMessage);

    callback();
  }
}

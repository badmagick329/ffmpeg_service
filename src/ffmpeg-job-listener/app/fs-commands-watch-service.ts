import type { JobCreationService } from "@/jobs";
import type { IFsWatcher } from "@/fs-watcher";
import type { LoggerPort } from "@/common/logger-port";

export class FsCommandsWatchService {
  private chain = Promise.resolve();
  private readonly log: LoggerPort;

  constructor(
    private readonly jobsCreationService: JobCreationService,
    private readonly watcher: IFsWatcher,
    logger: LoggerPort
  ) {
    this.log = logger.withContext({ service: "FsCommandsWatchService" });
  }

  start() {
    this.watcher.onAdd = this.onChange;
    this.watcher.onChange = this.onChange;
    this.watcher.onUnlink = () => undefined;

    this.watcher.watch({});
  }

  private onChange = (filepath: string): void => {
    this.log.info(`File changed: ${filepath}`);
    this.chain = this.chain
      .then(() => this.handleFileUpdate(filepath))
      .catch((err) => {
        console.error("Error handling file update:", err);
      });
  };

  private handleFileUpdate = async (filepath: string) => {
    (await Bun.file(filepath).text())
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => Boolean(l) && !l.startsWith("#"))
      .forEach((c) => {
        try {
          this.jobsCreationService.enqueueUnique(c);
        } catch (err) {
          console.error(`Error enqueueing command "${c}":`, err);
        }
      });
  };
}

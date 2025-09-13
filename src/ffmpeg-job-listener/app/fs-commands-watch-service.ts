import type { JobCreationService } from "@/jobs";
import type { IFsWatcher } from "@/file-ingestion/core/ifs-watcher";

export class FsCommandsWatchService {
  private chain = Promise.resolve();

  constructor(
    private readonly jobsCreationService: JobCreationService,
    private readonly watcher: IFsWatcher
  ) {}

  start() {
    this.watcher.onAdd = this.onChange;
    this.watcher.onChange = this.onChange;
    this.watcher.onUnlink = () => undefined;

    this.watcher.watch({});
  }

  private onChange = (filepath: string): void => {
    console.log(`[FsCommandsWatchService] - File changed: ${filepath}`);
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
      .filter((l) => Boolean(l))
      .forEach((c) => {
        try {
          this.jobsCreationService.enqueueUnique(c);
        } catch (err) {
          console.error(`Error enqueueing command "${c}":`, err);
        }
      });
  };
}

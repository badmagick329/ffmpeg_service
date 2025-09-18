import type { IFsWatcher } from "@/fs-watcher";
import type { InputFilesRepo } from "@/file-ingestion/input-files-repo";
import type { Stats } from "fs";

export class InputFilesWatchService {
  constructor(
    private readonly inputsRepo: InputFilesRepo,
    private readonly watcher: IFsWatcher
  ) {}

  start() {
    this.watcher.onAdd = this.onAdd;
    this.watcher.onUnlink = this.onUnlink;
    this.watcher.onChange = () => undefined;

    this.watcher.watch({});
  }

  private onAdd = (filepath: string, stats?: Stats): void => {
    console.log(`[InputFilesWatchService] - File added: ${filepath}`);
    const result = this.inputsRepo.add(filepath);
    if (!result) {
      // TODO: Logging/retry
      return;
    }
  };

  private onUnlink = (filepath: string, stats?: Stats): void => {
    console.log(`[InputFilesWatchService] - File removed: ${filepath}`);
    const result = this.inputsRepo.remove(filepath);
    if (!result) {
      // TODO: Logging/retry
      return;
    }
  };
}

import type { IFsWatcher } from "@/fs-watcher";
import type { InputFilesRepo } from "@/file-ingestion/input-files-repo";
import type { Stats } from "fs";
import * as fs from "node:fs/promises";

export class InputFilesWatchService {
  constructor(
    private readonly inputsRepo: InputFilesRepo,
    private readonly watcher: IFsWatcher,
    private readonly inputsDir: string
  ) {}

  start() {
    this.watcher.onAdd = this.onAdd;
    this.watcher.onUnlink = this.onUnlink;
    this.watcher.onChange = () => undefined;

    this.bgJobTest();
    this.watcher.watch({});
  }

  private async bgJobTest() {
    await this.reconcileInputFiles();
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      console.log(
        `[${
          new Date().toISOString().split(".")[0]
        } - InputFilesWatchService] - Checking input dir list`
      );
      await this.reconcileInputFiles();
    }
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

  private async reconcileInputFiles() {
    try {
      const inputFilesList = await fs.readdir(this.inputsDir);
      this.inputsRepo.reconcileInputFiles(inputFilesList);
    } catch (error) {
      console.log(
        "[InputFilesWatchService] - Error reconciling input dir",
        error
      );
    }
  }
}

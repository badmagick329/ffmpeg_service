import type { IFsWatcher } from "@/fs-watcher";
import type { InputFilesRepo } from "@/file-ingestion/input-files-repo";
import type { Stats } from "fs";
import * as fs from "node:fs/promises";
import type { LoggerPort } from "@/common/logger-port";

export class InputFilesWatchService {
  private readonly log: LoggerPort;
  constructor(
    private readonly inputsRepo: InputFilesRepo,
    private readonly watcher: IFsWatcher,
    private readonly inputsDir: string,
    logger: LoggerPort
  ) {
    this.log = logger.withContext({ service: "InputFilesWatchService" });
  }

  start() {
    this.watcher.onAdd = this.onAdd;
    this.watcher.onUnlink = this.onUnlink;
    this.watcher.onChange = () => undefined;

    this.monitorInputFiles();
    this.watcher.watch({});
  }

  private async monitorInputFiles() {
    await this.reconcileInputFiles();
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
      this.log.info("Checking input dir list");
      await this.reconcileInputFiles();
    }
  }

  private onAdd = (filepath: string, stats?: Stats): void => {
    const result = this.inputsRepo.add(filepath);
    if (!result) {
      this.log.error("Failed to add file:", { filepath });
      return;
    }
    this.log.info("File added to repo:", { filepath });
  };

  private onUnlink = (filepath: string, stats?: Stats): void => {
    const result = this.inputsRepo.remove(filepath);
    if (!result) {
      this.log.error("Failed to remove file:", { filepath });
      return;
    }
    this.log.info("File removed from repo:", { filepath });
  };

  private async reconcileInputFiles() {
    try {
      const inputFilesList = await fs.readdir(this.inputsDir);
      this.inputsRepo.reconcileInputFiles(inputFilesList);
    } catch (error) {
      this.log.error("Error reconciling input dir", { error });
    }
  }
}

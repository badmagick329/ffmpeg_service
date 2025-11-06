import type { IFsWatcher } from "@/fs-watcher";
import type { InputFilesRepo } from "@/file-ingestion/input-files-repo";
import type { Stats } from "fs";
import * as fs from "node:fs";
import type { LoggerPort } from "@/common/logger-port";

export class InputFilesWatchService {
  private readonly inputsRepo: InputFilesRepo;
  private readonly watcher: IFsWatcher;
  private readonly inputsDir: string;
  private readonly log: LoggerPort;
  private pauseWatchFlagFile: string;

  private watchPausedAt: number = 0;

  constructor({
    inputsRepo,
    watcher,
    inputsDir,
    pauseWatchFlagFile,
    logger,
  }: {
    inputsRepo: InputFilesRepo;
    watcher: IFsWatcher;
    inputsDir: string;
    pauseWatchFlagFile: string;
    logger: LoggerPort;
  }) {
    this.inputsRepo = inputsRepo;
    this.watcher = watcher;
    this.inputsDir = inputsDir;
    this.pauseWatchFlagFile = pauseWatchFlagFile;
    this.log = logger.withContext({ service: "InputFilesWatchService" });
  }

  start() {
    this.watcher.onAdd = this.onAdd;
    this.watcher.onUnlink = this.onUnlink;
    this.watcher.onChange = () => undefined;

    this.reconcileInputFiles();
    this.watcher.watch({ stabilityThreshold: 5000 });
  }

  private onAdd = (filepath: string, stats?: Stats): void => {
    if (this.watchPausedAt > 0) {
      return;
    }
    if (this.pauseWatchFlagFile.endsWith(filepath)) {
      this.watchPausedAt = Date.now();
      this.log.info("Watch paused due to pause flag file detected", {
        filepath,
      });
      return;
    }

    const result = this.inputsRepo.add(filepath);
    if (!result) {
      if (this.inputsRepo.exists(filepath)) {
        return;
      }
      this.log.error(`Failed to add file: ${filepath}`, { filepath });
      return;
    }
    this.log.info(`File added to repo: ${filepath}`, { filepath });
  };

  private onUnlink = (filepath: string, stats?: Stats): void => {
    if (this.pauseWatchFlagFile.endsWith(filepath)) {
      this.log.info("Watch resumed due to pause flag file removed", {
        filepath,
      });
      this.watchPausedAt = 0;
      this.reconcileInputFiles();
      return;
    }

    const result = this.inputsRepo.remove(filepath);
    if (!result) {
      this.log.error(`Failed to remove file: ${filepath}`, { filepath });
      return;
    }
    this.log.info(`File removed from repo: ${filepath}`, { filepath });
  };

  private reconcileInputFiles() {
    try {
      const inputFilesList = fs.readdirSync(this.inputsDir);
      this.inputsRepo.reconcileInputFiles(inputFilesList);
    } catch (error) {
      this.log.error(`Error reconciling input dir: ${error}`, { error });
    }
  }
}

import type { IFsWatcher } from "@/core/watchers/ifs-watcher";
import type { IInputFilesRepository } from "@/core/repositories/iinput-files-repository";
import type { IJobsRepository } from "@/core/repositories/ijobs-repository";
import { JOB_STATUS } from "@/core/models/job";
import type { Stats } from "fs";

export class InputFilesWatchService {
  constructor(
    private readonly inputsRepo: IInputFilesRepository,
    private readonly jobsRepo: IJobsRepository,
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
    this.jobsRepo.changeStatusFrom(
      filepath,
      JOB_STATUS.MISSING_INPUT,
      JOB_STATUS.PENDING
    );
  };

  private onUnlink = (filepath: string, stats?: Stats): void => {
    console.log(`[InputFilesWatchService] - File removed: ${filepath}`);
    const result = this.inputsRepo.remove(filepath);
    if (!result) {
      // TODO: Logging/retry
      return;
    }
    this.jobsRepo.changeStatusFrom(
      filepath,
      JOB_STATUS.PENDING,
      JOB_STATUS.MISSING_INPUT
    );
  };
}

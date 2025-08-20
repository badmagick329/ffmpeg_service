import type { IFsWatcher, MakeWatcher, OnChange } from "../core/ifs-watcher";
import type { IInputFilesRepository } from "../core/iinput-files-repository";
import type { IJobsRepository } from "../core/ijobs-repository";
import { JOB_STATUS } from "../core/job";

export class InputWatchService {
  private watcher?: IFsWatcher;

  constructor(
    private readonly inputsRepo: IInputFilesRepository,
    private readonly jobsRepo: IJobsRepository,
    private readonly makeWatcher: MakeWatcher
  ) {}

  start() {
    this.watcher = this.makeWatcher(this.onFsEvent);
    this.watcher.watch({});
  }

  private onFsEvent: OnChange = (event, filepath) => {
    if (event === "add") {
      this.inputsRepo.add(filepath);
      this.jobsRepo.updateStatusFrom(
        filepath,
        JOB_STATUS.MISSING_INPUT,
        JOB_STATUS.PENDING
      );
      return;
    }

    if (event === "unlink") {
      this.inputsRepo.remove(filepath);
      this.jobsRepo.updateStatusFrom(
        filepath,
        JOB_STATUS.PENDING,
        JOB_STATUS.MISSING_INPUT
      );
      return;
    }
  };
}

import type {
  IFsWatcher,
  MakeWatcher,
  OnChange,
} from "@/core/watchers/ifs-watcher";
import type { IInputFilesRepository } from "@/core/repositories/iinput-files-repository";
import type { IJobsRepository } from "@/core/repositories/ijobs-repository";
import { JOB_STATUS } from "@/core/models/job";

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
      const result = this.inputsRepo.add(filepath);
      if (!result) {
        // TODO: Logging/retry
        return null;
      }
      this.jobsRepo.changeStatusFrom(
        filepath,
        JOB_STATUS.MISSING_INPUT,
        JOB_STATUS.PENDING
      );
      return;
    }

    if (event === "unlink") {
      const result = this.inputsRepo.remove(filepath);
      if (!result) {
        // TODO: Logging/retry
        return null;
      }
      this.jobsRepo.changeStatusFrom(
        filepath,
        JOB_STATUS.PENDING,
        JOB_STATUS.MISSING_INPUT
      );
      return;
    }
  };
}

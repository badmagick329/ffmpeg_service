import type { IFsWatcher, MakeWatcher, OnChange } from "../core/ifs-watcher";
import type { IInputFilesRepository } from "../core/iinput-files-repository";

export class InputWatchService {
  private watcher?: IFsWatcher;

  constructor(
    private readonly repo: IInputFilesRepository,
    private readonly makeWatcher: MakeWatcher
  ) {}

  start() {
    this.watcher = this.makeWatcher(this.onFsEvent);
    this.watcher.watch({});
  }

  private onFsEvent: OnChange = (event, filepath) => {
    if (event === "add") {
      this.repo.add(filepath);
      return;
    }

    if (event === "unlink") {
      this.repo.remove(filepath);
      return;
    }
  };
}

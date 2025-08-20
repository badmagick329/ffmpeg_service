import type { OnChange } from "../core/ifs-watcher";
import { FsWatcher } from "./fs-watcher";

export type PathSet = true | false;
export type CallbackSet = true | false;

export type FsWatcherConfig = {
  watchPath: string;
  onChange: OnChange;
};

export type Conf<P extends PathSet, C extends CallbackSet> = (P extends true
  ? { watchPath: string }
  : {}) &
  (C extends true ? { onChange: FsWatcherConfig["onChange"] } : {});

export class FsWatcherBuilder<P extends PathSet, C extends CallbackSet> {
  private declare __brand: { watchPath: P; onChange: C };

  private constructor(private readonly config: Conf<P, C> = {} as Conf<P, C>) {}

  static start() {
    return new FsWatcherBuilder<false, false>();
  }

  watchPath(watchPath: string) {
    return new FsWatcherBuilder<true, C>({ ...this.config, watchPath } as Conf<
      true,
      C
    >);
  }

  onChange(onChange: FsWatcherConfig["onChange"]) {
    return new FsWatcherBuilder<P, true>({ ...this.config, onChange } as Conf<
      P,
      true
    >);
  }

  build(this: FsWatcherBuilder<true, true>): FsWatcher {
    return new FsWatcher(this.config.watchPath, this.config.onChange);
  }
}

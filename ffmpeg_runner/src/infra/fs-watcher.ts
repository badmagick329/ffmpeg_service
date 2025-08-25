import chokidar from "chokidar";
import type { OnChange } from "@/core/watchers/ifs-watcher";

export class FsWatcher {
  constructor(
    private readonly watchPath: string,
    private readonly onChange: OnChange
  ) {}

  watch({
    stabilityThreshold = 2000,
    pollInterval = 100,
    usePolling = false,
    depth = 0,
    ignoreInitial = true,
  }: {
    stabilityThreshold?: number;
    pollInterval?: number;
    usePolling?: boolean;
    depth?: number;
    ignoreInitial?: boolean;
  }) {
    chokidar
      .watch(this.watchPath, {
        awaitWriteFinish: {
          stabilityThreshold,
          pollInterval,
        },
        interval: 100,
        binaryInterval: 300,
        usePolling,
        depth,
        ignoreInitial,
      })
      // @ts-ignore - For narrower types
      .on("add", this.onChange)
      // @ts-ignore - For narrower types
      .on("unlink", this.onChange);
  }
}

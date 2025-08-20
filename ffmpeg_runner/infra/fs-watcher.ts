import chokidar from "chokidar";
import type { OnChange } from "../core/ifs-watcher";

// path type on add event:
//  * Stats {
//  *   dev: 2114,
//  *   ino: 48064969,
//  *   mode: 33188,
//  *   nlink: 1,
//  *   uid: 85,
//  *   gid: 100,
//  *   rdev: 0,
//  *   size: 527,
//  *   blksize: 4096,
//  *   blocks: 8,
//  *   atimeMs: 1318289051000.1,
//  *   mtimeMs: 1318289051000.1,
//  *   ctimeMs: 1318289051000.1,
//  *   birthtimeMs: 1318289051000.1,
//  *   atime: Mon, 10 Oct 2011 23:24:11 GMT,
//  *   mtime: Mon, 10 Oct 2011 23:24:11 GMT,
//  *   ctime: Mon, 10 Oct 2011 23:24:11 GMT,
//  *   birthtime: Mon, 10 Oct 2011 23:24:11 GMT }

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

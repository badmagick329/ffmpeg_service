import chokidar from "chokidar";
import { mkdirSync, Stats } from "fs";

export type Event = "add" | "unlink" | "change" | "addDir" | "unlinkDir";

export interface IFsWatcher {
  onAdd(filepath: string, stats?: Stats | undefined): void;
  onUnlink(filepath: string, stats?: Stats | undefined): void;
  onChange(filepath: string, stats?: Stats | undefined): void;

  watch(options: {
    stabilityThreshold?: number;
    pollInterval?: number;
    usePolling?: boolean;
    depth?: number;
    ignoreInitial?: boolean;
  }): Promise<void>;
}

export class FsWatcher implements IFsWatcher {
  constructor(private readonly watchPath: string) {}
  onAdd(filepath: string, stats?: Stats | undefined): void {
    throw new Error("Method not implemented.");
  }
  onUnlink(filepath: string, stats?: Stats | undefined): void {
    throw new Error("Method not implemented.");
  }
  onChange(filepath: string, stats?: Stats | undefined): void {
    throw new Error("Method not implemented.");
  }

  async watch({
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
    mkdirSync(this.watchPath, { recursive: true });
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
      .on("add", this.onAdd)
      .on("unlink", this.onUnlink)
      .on("change", this.onChange);
  }
}

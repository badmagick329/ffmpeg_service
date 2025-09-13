import { Stats } from "fs";
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

export type OnChange = (event: "add" | "unlink", filepath: string) => void;

export interface IFsWatcher {
  watch(options: {
    stabilityThreshold?: number;
    pollInterval?: number;
    usePolling?: boolean;
    depth?: number;
    ignoreInitial?: boolean;
  }): void;
}

export type MakeWatcher = (onChange: OnChange) => IFsWatcher;

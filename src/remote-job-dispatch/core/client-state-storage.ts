import type { Result } from "@/common/result";
import type { ClientState } from "@/remote-job-dispatch/core/client-state-manager";
import type {
  FileIOError,
  StateFileBackupError,
} from "@/remote-job-dispatch/core/errors";

export interface ClientStateStorage {
  saveState(state: ClientState): Promise<Result<void, FileIOError>>;
  loadState(): Promise<Result<ClientState, StateFileBackupError>>;
}

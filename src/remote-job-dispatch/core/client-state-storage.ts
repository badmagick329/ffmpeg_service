import type { ClientState } from "@/remote-job-dispatch/core/client-state-manager";

export interface ClientStateStorage {
  saveState(state: ClientState): Promise<void>;
  loadState(): Promise<ClientState>;
}

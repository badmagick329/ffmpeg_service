import { Result } from "@/common/result";
import { type ClientState } from "@/remote-job-dispatch/core/client-state-manager";
import type { ClientStateStorage } from "@/remote-job-dispatch/core/client-state-storage";
import {
  FileIOError,
  StateFileBackupError,
} from "@/remote-job-dispatch/core/errors";

export class ClientStateJsonStorage implements ClientStateStorage {
  constructor(private readonly filePath: string) {}

  async saveState(state: ClientState): Promise<Result<void, FileIOError>> {
    return (
      await Result.fromThrowableAsync(async () => {
        try {
          const content = JSON.stringify(state, null, 2);
          await Bun.file(this.filePath).write(content);
        } catch (error) {
          console.error("Error saving state file:", error);
          throw error;
        }
      })
    ).mapError((e) => new FileIOError(this.filePath, "write", e));
  }
  async loadState(): Promise<Result<ClientState, StateFileBackupError>> {
    const file = Bun.file(this.filePath);

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as ClientState;

      if (!parsed.version || !parsed.servers) {
        throw new Error("Invalid state file structure");
      }

      return Result.success(parsed);
    } catch (error) {
      console.error("Error loading state file:", error);
      const backupResult = await this.backupCorruptedState();
      return backupResult.map(() => ({
        version: "1.0",
        servers: {},
      }));
    }
  }

  private async backupCorruptedState(): Promise<
    Result<void, StateFileBackupError>
  > {
    const backupPath = `${this.filePath}.backup`;
    return (
      await Result.fromThrowableAsync(async () => {
        await Bun.write(Bun.file(backupPath), Bun.file(this.filePath));
        console.log(
          `State file corrupted, starting fresh. Backup saved to ${backupPath}`
        );
      })
    ).mapError((e) => new StateFileBackupError(this.filePath, e));
  }
}

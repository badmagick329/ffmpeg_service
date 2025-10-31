import { type ClientState } from "@/remote-job-dispatch/core/client-state-manager";
import type { ClientStateStorage } from "@/remote-job-dispatch/core/client-state-storage";

export class ClientStateJsonStorage implements ClientStateStorage {
  constructor(private readonly filePath: string) {}

  async saveState(state: ClientState): Promise<void> {
    try {
      const content = JSON.stringify(state, null, 2);
      await Bun.file(this.filePath).write(content);
    } catch (error) {
      console.error("Error saving state file:", error);
      throw error;
    }
  }
  async loadState(): Promise<ClientState> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) {
      return {
        version: "1.0",
        servers: {},
      };
    }

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as ClientState;

      if (!parsed.version || !parsed.servers) {
        throw new Error("Invalid state file structure");
      }

      return parsed;
    } catch (error) {
      console.error("Error loading state file:", error);
      await this.backupCorruptedState();
      return {
        version: "1.0",
        servers: {},
      };
    }
  }

  private async backupCorruptedState(): Promise<void> {
    const backupPath = `${this.filePath}.backup`;
    try {
      await Bun.write(Bun.file(backupPath), Bun.file(this.filePath));
      console.log(
        `State file corrupted, starting fresh. Backup saved to ${backupPath}`
      );
    } catch (error) {
      console.error("Error backing up corrupted state file:", error);
    }
  }
}

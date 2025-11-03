export type DownloadStatus =
  | "waiting"
  | "downloading"
  | "completed"
  | "interrupted";
export type OperationType =
  | "upload_command"
  | "upload_input"
  | "download_output"
  | "cleanup_input";
export type OperationStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "interrupted";

export interface PendingDownload {
  outputFile: string;
  remoteFile: string;
  status: DownloadStatus;
  addedAt: string;
  relatedInputFile: string;
  lastChecked?: string;
}

export interface UploadedInputFile {
  localFile: string;
  remoteFile: string;
  uploadedAt: string;
}

export interface Operation {
  type: OperationType;
  file: string;
  status: OperationStatus;
  startedAt: string;
  completedAt?: string;
}

export interface ServerState {
  pendingDownloads: PendingDownload[];
  uploadedInputFiles: UploadedInputFile[];
  operations: Operation[];
}

export interface ClientState {
  version: string;
  servers: Record<string, ServerState>;
}

export interface InterruptedOperation {
  server: string;
  operation: Operation;
}

import { Result } from "@/common/result";
import type { ServerConfig } from "@/infra/config";
import type { ClientStateStorage } from "@/remote-job-dispatch/core/client-state-storage";
import {
  FileIOError,
  ServerNotFoundError,
} from "@/remote-job-dispatch/core/errors";

export class ClientStateManager {
  private constructor(
    private readonly state: ClientState,
    private readonly stateStorage: ClientStateStorage
  ) {}

  static async create(
    serverConfigs: ServerConfig[],
    stateStorage: ClientStateStorage
  ): Promise<ClientStateManager> {
    try {
      let stateResult = await stateStorage.loadState();
      if (stateResult.isFailure) {
        throw stateResult.unwrapError();
      }
      let state = stateResult.unwrap();
      state = await ClientStateManager.migrateState(state, serverConfigs);

      const manager = new ClientStateManager(state, stateStorage);
      // Persist migrated state if migration occurred
      await stateStorage.saveState(state);

      return manager;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Migrate old state file that used IP addresses as keys to use serverNames
   */
  private static async migrateState(
    state: ClientState,
    serverConfigs: ServerConfig[]
  ): Promise<ClientState> {
    const migratedServers: Record<string, ServerState> = {};
    let migrationOccurred = false;

    for (const [key, serverState] of Object.entries(state.servers)) {
      const isIpKey =
        /^\d+\.\d+\.\d+\.\d+$/.test(key) ||
        key.includes(".") ||
        key.includes(":");

      if (isIpKey) {
        const serverConfig = serverConfigs.find((s) => s.sshHostIP === key);
        if (serverConfig) {
          console.log(`Migrating state: ${key} → ${serverConfig.serverName}`);
          migratedServers[serverConfig.serverName] = serverState;
          migrationOccurred = true;
        } else {
          console.warn(
            `⚠️  Could not migrate server state for IP: ${key} (no matching config)`
          );
          migratedServers[key] = serverState;
        }
      } else {
        migratedServers[key] = serverState;
      }
    }

    if (migrationOccurred) {
      console.log("✓ State migration completed");
    }

    return {
      ...state,
      servers: migratedServers,
    };
  }

  async addPendingDownload(
    server: string,
    download: Omit<PendingDownload, "status" | "addedAt">
  ): Promise<void> {
    if (!this.state.servers[server]) {
      this.state.servers[server] = {
        pendingDownloads: [],
        uploadedInputFiles: [],
        operations: [],
      };
    }

    const fullDownload: PendingDownload = {
      ...download,
      status: "waiting",
      addedAt: new Date().toISOString(),
    };

    this.state.servers[server].pendingDownloads.push(fullDownload);
    await this.stateStorage.saveState(this.state);
  }

  async markDownloadAs(
    server: string,
    outputFile: string,
    status: "downloading" | "completed" | "interrupted"
  ): Promise<Result<void, FileIOError | ServerNotFoundError>> {
    const serverState = this.state.servers[server];
    if (!serverState) {
      return Result.failure(new ServerNotFoundError(server));
    }

    const download = serverState.pendingDownloads.find(
      (d) => d.outputFile === outputFile
    );
    if (download) {
      download.status = status;
      return await this.stateStorage.saveState(this.state);
    }
    return Result.success(undefined);
  }

  async addUploadedInputFile(
    server: string,
    inputFile: Omit<UploadedInputFile, "uploadedAt">
  ): Promise<void> {
    if (!this.state.servers[server]) {
      this.state.servers[server] = {
        pendingDownloads: [],
        uploadedInputFiles: [],
        operations: [],
      };
    }

    const fullInputFile: UploadedInputFile = {
      ...inputFile,
      uploadedAt: new Date().toISOString(),
    };

    this.state.servers[server].uploadedInputFiles.push(fullInputFile);
    await this.stateStorage.saveState(this.state);
  }

  getAllPendingDownloads(server: string): PendingDownload[] {
    return this.state.servers[server]?.pendingDownloads || [];
  }

  getWaitingDownloads(server: string): PendingDownload[] {
    return this.getAllPendingDownloads(server).filter(
      (d) => d.status === "waiting"
    );
  }

  getAllUploadedInputFiles(server: string): UploadedInputFile[] {
    return this.state.servers[server]?.uploadedInputFiles || [];
  }

  areAllDownloadsCompleted(server: string): boolean {
    const serverState = this.state.servers[server];
    if (!serverState) return true;

    return serverState.pendingDownloads.every(
      (d) => d.status === "completed" || d.status === "interrupted"
    );
  }

  async removeServerState(server: string): Promise<void> {
    delete this.state.servers[server];
    await this.stateStorage.saveState(this.state);
  }

  getInterruptedOperations(): InterruptedOperation[] {
    const interrupted: InterruptedOperation[] = [];

    for (const [server, serverState] of Object.entries(this.state.servers)) {
      for (const download of serverState.pendingDownloads) {
        if (download.status === "downloading") {
          interrupted.push({
            server,
            operation: {
              type: "download_output",
              file: download.outputFile,
              status: "interrupted",
              startedAt: download.lastChecked || download.addedAt,
            },
          });
        }
      }

      for (const operation of serverState.operations) {
        if (operation.status === "in_progress") {
          interrupted.push({
            server,
            operation: {
              ...operation,
              status: "interrupted",
            },
          });
        }
      }
    }

    return interrupted;
  }

  async markInterruptedOperations(): Promise<void> {
    const interrupted = this.getInterruptedOperations();

    for (const { server, operation } of interrupted) {
      const serverState = this.state.servers[server];
      if (!serverState) continue;

      if (operation.type === "download_output") {
        const download = serverState.pendingDownloads.find(
          (d) => d.outputFile === operation.file
        );
        if (download) {
          download.status = "interrupted";
        }
      }

      const op = serverState.operations.find(
        (o) => o.file === operation.file && o.type === operation.type
      );
      if (op) {
        op.status = "interrupted";
      }
    }

    if (interrupted.length > 0) {
      await this.stateStorage.saveState(this.state);
    }
  }

  getAllServersWithPendingWork(): string[] {
    return Object.keys(this.state.servers).filter(
      (server) => !this.isServerIdle(server)
    );
  }

  async getUnusedInputFilesOnServers(servers: ServerConfig[]): Promise<
    {
      server: ServerConfig;
      uploadedInputFiles: UploadedInputFile[];
    }[]
  > {
    let unusedInputFilesOnServers = [] as {
      server: ServerConfig;
      uploadedInputFiles: UploadedInputFile[];
    }[];

    for (const server of servers) {
      const uploadedInputFiles = await this.getUnusedInputFilesOnServer(server);

      if (uploadedInputFiles.length === 0) {
        continue;
      }

      unusedInputFilesOnServers.push({
        server: server,
        uploadedInputFiles,
      });
    }
    return unusedInputFilesOnServers;
  }

  private async getUnusedInputFilesOnServer(
    server: ServerConfig
  ): Promise<UploadedInputFile[]> {
    const inputFiles = Array.from(
      new Map(
        this.getAllUploadedInputFiles(server.serverName).map((item) => [
          item.localFile,
          item,
        ])
      ).values()
    );

    const inUseFiles = new Set(
      this.getAllPendingDownloads(server.serverName)
        .filter((p) => p.status !== "completed")
        .map((p) => p.relatedInputFile)
    );

    return inputFiles.filter((f) => !inUseFiles.has(f.localFile));
  }

  /**
   * Best guess at whether the server has pending work.
   * This is not a definitive check
   */
  private isServerIdle(server: string): boolean {
    const serverState = this.state.servers[server];
    if (!serverState) return true;

    const hasWaitingDownloads = serverState.pendingDownloads.some(
      (d) => d.status === "waiting" || d.status === "downloading"
    );

    return !hasWaitingDownloads;
  }
}

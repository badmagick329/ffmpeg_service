import { describe, it, expect, beforeEach } from "bun:test";
import {
  ClientStateManager,
  type ClientState,
} from "@/remote-job-dispatch/core/client-state-manager";
import type { ClientStateStorage } from "@/remote-job-dispatch/core/client-state-storage";
import type { ServerConfig } from "@/infra/config";
import type {
  FileIOError,
  StateFileBackupError,
} from "@/remote-job-dispatch/core/errors";
import type { Result } from "@/common/result";

class InMemoryStateStorage implements ClientStateStorage {
  private state: ClientState = {
    version: "1.0",
    servers: {},
  };

  async saveState(state: ClientState): Promise<Result<void, FileIOError>> {
    return (this.state = JSON.parse(JSON.stringify(state)));
  }

  async loadState(): Promise<Result<ClientState, StateFileBackupError>> {
    return JSON.parse(JSON.stringify(this.state));
  }

  reset(): void {
    this.state = { version: "1.0", servers: {} };
  }
}

describe("ClientStateManager", () => {
  let storage: InMemoryStateStorage;
  let serverConfigs: ServerConfig[];

  beforeEach(() => {
    storage = new InMemoryStateStorage();
    serverConfigs = [
      {
        serverName: "server1",
        sshHostIP: "192.168.1.10",
        sshUser: "user",
        sshKeyPath: "/path/to/key",
        remoteWorkDir: "/work",
        remoteCmdsDir: "/cmds",
        remoteSuccessDir: "/success",
        successFlag: "done",
        pauseWatchFlagFile: "incoming",
        copyTo: "/to",
        copyFrom: "/from",
      },
      {
        serverName: "server2",
        sshHostIP: "192.168.1.20",
        sshUser: "user",
        sshKeyPath: "/path/to/key",
        remoteWorkDir: "/work",
        remoteCmdsDir: "/cmds",
        remoteSuccessDir: "/success",
        successFlag: "done",
        pauseWatchFlagFile: "incoming",
        copyTo: "/to",
        copyFrom: "/from",
      },
    ];
  });

  describe("create", () => {
    it("should initialize with empty state", async () => {
      const manager = await ClientStateManager.create(serverConfigs, storage);

      const pendingDownloads = manager.getAllPendingDownloads("server1");
      expect(pendingDownloads).toEqual([]);
    });

    it("should migrate IP-based keys to server names", async () => {
      await storage.saveState({
        version: "1.0",
        servers: {
          "192.168.1.10": {
            pendingDownloads: [],
            uploadedInputFiles: [
              {
                localFile: "input.mkv",
                remoteFile: "/work/input.mkv",
                uploadedAt: "2025-01-01T00:00:00Z",
              },
            ],
            operations: [],
          },
        },
      });

      const manager = await ClientStateManager.create(serverConfigs, storage);

      const uploadedFiles = manager.getAllUploadedInputFiles("server1");
      expect(uploadedFiles).toHaveLength(1);
      expect(uploadedFiles[0]!.localFile).toBe("input.mkv");
    });
  });

  describe("pending downloads", () => {
    it("should add and retrieve pending downloads", async () => {
      const manager = await ClientStateManager.create(serverConfigs, storage);

      await manager.addPendingDownload("server1", {
        outputFile: "output.mkv",
        remoteFile: "/work/output.mkv",
        relatedInputFile: "input.mkv",
      });

      const downloads = manager.getAllPendingDownloads("server1");
      expect(downloads).toHaveLength(1);
      expect(downloads[0]!.outputFile).toBe("output.mkv");
      expect(downloads[0]!.status).toBe("waiting");
    });

    it("should track download status transitions", async () => {
      const manager = await ClientStateManager.create(serverConfigs, storage);

      await manager.addPendingDownload("server1", {
        outputFile: "output.mkv",
        remoteFile: "/work/output.mkv",
        relatedInputFile: "input.mkv",
      });

      await manager.markDownloadAs("server1", "output.mkv", "downloading");
      let downloads = manager.getAllPendingDownloads("server1");
      expect(downloads[0]!.status).toBe("downloading");

      await manager.markDownloadAs("server1", "output.mkv", "completed");
      downloads = manager.getAllPendingDownloads("server1");
      expect(downloads[0]!.status).toBe("completed");
    });

    it("should get only waiting downloads", async () => {
      const manager = await ClientStateManager.create(serverConfigs, storage);

      await manager.addPendingDownload("server1", {
        outputFile: "waiting.mkv",
        remoteFile: "/work/waiting.mkv",
        relatedInputFile: "input1.mkv",
      });
      await manager.addPendingDownload("server1", {
        outputFile: "downloading.mkv",
        remoteFile: "/work/downloading.mkv",
        relatedInputFile: "input2.mkv",
      });

      await manager.markDownloadAs("server1", "downloading.mkv", "downloading");

      const waitingDownloads = manager.getWaitingDownloads("server1");
      expect(waitingDownloads).toHaveLength(1);
      expect(waitingDownloads[0]!.outputFile).toBe("waiting.mkv");
    });

    it("should check if all downloads are completed", async () => {
      const manager = await ClientStateManager.create(serverConfigs, storage);

      await manager.addPendingDownload("server1", {
        outputFile: "output1.mkv",
        remoteFile: "/work/output1.mkv",
        relatedInputFile: "input1.mkv",
      });
      await manager.addPendingDownload("server1", {
        outputFile: "output2.mkv",
        remoteFile: "/work/output2.mkv",
        relatedInputFile: "input2.mkv",
      });

      expect(manager.areAllDownloadsCompleted("server1")).toBe(false);

      await manager.markDownloadAs("server1", "output1.mkv", "completed");
      expect(manager.areAllDownloadsCompleted("server1")).toBe(false);

      await manager.markDownloadAs("server1", "output2.mkv", "completed");
      expect(manager.areAllDownloadsCompleted("server1")).toBe(true);
    });
  });

  describe("uploaded input files", () => {
    it("should add and retrieve uploaded input files", async () => {
      const manager = await ClientStateManager.create(serverConfigs, storage);

      await manager.addUploadedInputFile("server1", {
        localFile: "input.mkv",
        remoteFile: "/work/input.mkv",
      });

      const uploadedFiles = manager.getAllUploadedInputFiles("server1");
      expect(uploadedFiles).toHaveLength(1);
      expect(uploadedFiles[0]!.localFile).toBe("input.mkv");
    });

    it("should identify unused input files", async () => {
      const manager = await ClientStateManager.create(serverConfigs, storage);

      await manager.addUploadedInputFile("server1", {
        localFile: "used.mkv",
        remoteFile: "/work/used.mkv",
      });
      await manager.addUploadedInputFile("server1", {
        localFile: "unused.mkv",
        remoteFile: "/work/unused.mkv",
      });

      await manager.addPendingDownload("server1", {
        outputFile: "output.mkv",
        remoteFile: "/work/output.mkv",
        relatedInputFile: "used.mkv",
      });

      const unusedFiles = await manager.getUnusedInputFilesOnServers(
        serverConfigs
      );

      expect(unusedFiles).toHaveLength(1);
      expect(unusedFiles[0]!.server.serverName).toBe("server1");
      expect(unusedFiles[0]!.uploadedInputFiles).toHaveLength(1);
      expect(unusedFiles[0]!.uploadedInputFiles[0]!.localFile).toBe(
        "unused.mkv"
      );
    });
  });

  describe("interrupted operations", () => {
    it("should detect downloads in progress as interrupted", async () => {
      const manager = await ClientStateManager.create(serverConfigs, storage);

      await manager.addPendingDownload("server1", {
        outputFile: "output.mkv",
        remoteFile: "/work/output.mkv",
        relatedInputFile: "input.mkv",
      });
      await manager.markDownloadAs("server1", "output.mkv", "downloading");

      const interrupted = manager.getInterruptedOperations();
      expect(interrupted).toHaveLength(1);
      expect(interrupted[0]!.server).toBe("server1");
      expect(interrupted[0]!.operation.file).toBe("output.mkv");
      expect(interrupted[0]!.operation.type).toBe("download_output");
    });

    it("should mark interrupted operations", async () => {
      const manager = await ClientStateManager.create(serverConfigs, storage);

      await manager.addPendingDownload("server1", {
        outputFile: "output.mkv",
        remoteFile: "/work/output.mkv",
        relatedInputFile: "input.mkv",
      });
      await manager.markDownloadAs("server1", "output.mkv", "downloading");

      await manager.markInterruptedOperations();

      const downloads = manager.getAllPendingDownloads("server1");
      expect(downloads[0]!.status).toBe("interrupted");
    });
  });

  describe("server state management", () => {
    it("should remove server state", async () => {
      const manager = await ClientStateManager.create(serverConfigs, storage);

      await manager.addPendingDownload("server1", {
        outputFile: "output.mkv",
        remoteFile: "/work/output.mkv",
        relatedInputFile: "input.mkv",
      });

      await manager.removeServerState("server1");

      const downloads = manager.getAllPendingDownloads("server1");
      expect(downloads).toEqual([]);
    });

    it("should list servers with pending work", async () => {
      const manager = await ClientStateManager.create(serverConfigs, storage);

      await manager.addPendingDownload("server1", {
        outputFile: "output.mkv",
        remoteFile: "/work/output.mkv",
        relatedInputFile: "input.mkv",
      });

      const serversWithWork = manager.getAllServersWithPendingWork();
      expect(serversWithWork).toContain("server1");
      expect(serversWithWork).not.toContain("server2");
    });

    it("should handle multiple servers independently", async () => {
      const manager = await ClientStateManager.create(serverConfigs, storage);

      await manager.addPendingDownload("server1", {
        outputFile: "output1.mkv",
        remoteFile: "/work/output1.mkv",
        relatedInputFile: "input1.mkv",
      });

      await manager.addPendingDownload("server2", {
        outputFile: "output2.mkv",
        remoteFile: "/work/output2.mkv",
        relatedInputFile: "input2.mkv",
      });

      const server1Downloads = manager.getAllPendingDownloads("server1");
      const server2Downloads = manager.getAllPendingDownloads("server2");

      expect(server1Downloads).toHaveLength(1);
      expect(server2Downloads).toHaveLength(1);
      expect(server1Downloads[0]!.outputFile).toBe("output1.mkv");
      expect(server2Downloads[0]!.outputFile).toBe("output2.mkv");
    });
  });
});

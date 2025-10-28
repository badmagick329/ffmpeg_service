import type { ServerConfig } from "@/infra/config";
import type { IFileOperations } from "@/remote-job-dispatch/core/ifile-operations";
import type { PendingDownload } from "@/remote-job-dispatch/core/client-state-manager";
import { ClientStateManager } from "@/remote-job-dispatch/core/client-state-manager";
import { basename } from "path";

export interface DownloadSummary {
  serversChecked: number;
  filesDownloaded: number;
  filesSkipped: number;
  filesPending: number;
  serversCompleted: string[];
  interruptedOperations: number;
}

export class DownloadManager {
  private readonly log = console.log;
  private fileOperations: IFileOperations;
  private stateManager: ClientStateManager;
  private serverConfigs: ServerConfig[];

  constructor({
    fileOperations,
    stateManager,
    serverConfigs,
  }: {
    fileOperations: IFileOperations;
    stateManager: ClientStateManager;
    serverConfigs: ServerConfig[];
  }) {
    this.fileOperations = fileOperations;
    this.stateManager = stateManager;
    this.serverConfigs = serverConfigs;
  }

  async processAllPendingDownloads(): Promise<DownloadSummary> {
    const summary: DownloadSummary = {
      serversChecked: 0,
      filesDownloaded: 0,
      filesSkipped: 0,
      filesPending: 0,
      serversCompleted: [],
      interruptedOperations: 0,
    };

    const interruptedCount = await this.handleInterruptedOperations();
    summary.interruptedOperations = interruptedCount;

    const serversWithWork = this.stateManager.getAllServersWithPendingWork();

    if (serversWithWork.length === 0) {
      this.log("No pending downloads found");
      return summary;
    }

    this.log(
      `Checking ${serversWithWork.length} server(s) for completed outputs...`
    );

    for (const serverHost of serversWithWork) {
      const server = this.findServerConfig(serverHost);
      if (!server) {
        this.log(`⚠️ Server config not found for: ${serverHost}`);
        continue;
      }

      summary.serversChecked++;
      const serverResult = await this.processServerDownloads(server);

      summary.filesDownloaded += serverResult.downloaded;
      summary.filesSkipped += serverResult.skipped;
      summary.filesPending += serverResult.pending;

      if (serverResult.allCompleted) {
        summary.serversCompleted.push(serverHost);
      }
    }

    return summary;
  }

  private async handleInterruptedOperations(): Promise<number> {
    const interrupted = this.stateManager.getInterruptedOperations();

    if (interrupted.length === 0) {
      return 0;
    }

    this.log(`\n⚠️ Detected ${interrupted.length} interrupted operation(s):`);

    for (const { server, operation } of interrupted) {
      this.log(
        `  - Server: ${server}, Type: ${operation.type}, File: ${operation.file}`
      );
      this.log(`    Status: Interrupted (skipping to avoid corruption)`);
      this.log(
        `    To retry: Edit client-state.json and change status to "waiting"`
      );
    }

    await this.stateManager.markInterruptedOperations();
    this.log("");

    return interrupted.length;
  }

  private findServerConfig(hostname: string): ServerConfig | undefined {
    return this.serverConfigs.find((s) => s.sshHost === hostname);
  }

  private async processServerDownloads(server: ServerConfig): Promise<{
    downloaded: number;
    skipped: number;
    pending: number;
    allCompleted: boolean;
  }> {
    const result = {
      downloaded: 0,
      skipped: 0,
      pending: 0,
      allCompleted: false,
    };

    const waitingDownloads = this.stateManager.getWaitingDownloads(
      server.sshHost
    );
    const allDownloads = this.stateManager.getAllPendingDownloads(
      server.sshHost
    );

    if (waitingDownloads.length === 0 && allDownloads.length > 0) {
      this.log(
        `Server ${server.sshHost}: No waiting downloads (all completed/interrupted)`
      );

      if (this.stateManager.areAllDownloadsCompleted(server.sshHost)) {
        await this.cleanupServerInputFiles(server);
        result.allCompleted = true;
      }

      return result;
    }

    this.log(
      `\nServer ${server.sshHost}: Checking ${waitingDownloads.length} file(s)...`
    );

    for (const download of waitingDownloads) {
      const isReady = await this.fileOperations.isFileReadyForDownload(
        server,
        download.outputFile
      );

      if (!isReady) {
        result.pending++;
        continue;
      }

      try {
        this.log(`  ↓ Downloading: ${basename(download.outputFile)}...`);
        await this.downloadReadyFile(server, download);
        result.downloaded++;
        this.log(`  ✓ Downloaded: ${basename(download.outputFile)}`);
      } catch (error) {
        this.log(`  ✗ Failed to download: ${basename(download.outputFile)}`);
        console.error(error);
        result.skipped++;
      }
    }

    if (this.stateManager.areAllDownloadsCompleted(server.sshHost)) {
      await this.cleanupServerInputFiles(server);
      result.allCompleted = true;
    }

    return result;
  }

  private async downloadReadyFile(
    server: ServerConfig,
    download: PendingDownload
  ): Promise<void> {
    await this.stateManager.markDownloadInProgress(
      server.sshHost,
      download.outputFile
    );

    try {
      await this.fileOperations.downloadFileAndCleanup(
        server,
        download.remoteFile,
        download.outputFile
      );

      await this.stateManager.markDownloadCompleted(
        server.sshHost,
        download.outputFile
      );
    } catch (error) {
      await this.stateManager.markDownloadInterrupted(
        server.sshHost,
        download.outputFile
      );
      throw error;
    }
  }

  private async cleanupServerInputFiles(server: ServerConfig): Promise<void> {
    const inputFiles = this.stateManager.getAllUploadedInputFiles(
      server.sshHost
    );

    if (inputFiles.length === 0) {
      this.log(`Server ${server.sshHost}: No input files to clean up`);
      await this.stateManager.removeServerState(server.sshHost);
      return;
    }

    this.log(
      `Server ${server.sshHost}: Cleaning up ${inputFiles.length} input file(s)...`
    );

    let cleaned = 0;
    let failed = 0;

    for (const inputFile of inputFiles) {
      try {
        await this.fileOperations.removeFile(server, inputFile.remoteFile);
        cleaned++;
      } catch (error) {
        console.error(`Failed to remove ${inputFile.remoteFile}:`, error);
        failed++;
      }
    }

    this.log(
      `Server ${server.sshHost}: Cleanup completed (${cleaned} removed, ${failed} failed)`
    );

    await this.stateManager.removeServerState(server.sshHost);
  }
}

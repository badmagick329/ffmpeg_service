import type { ServerConfig } from "@/infra/config";
import type { IFileOperations } from "@/remote-job-dispatch/core/ifile-operations";
import type { PendingDownload } from "@/remote-job-dispatch/core/client-state-manager";
import { ClientStateManager } from "@/remote-job-dispatch/core/client-state-manager";
import { createProgressBar } from "@/remote-job-dispatch/utils/progress-bar";
import { basename } from "path";

export interface DownloadSummary {
  serversChecked: number;
  filesDownloaded: number;
  filesSkipped: number;
  filesPending: number;
  serversCompleted: string[];
  interruptedOperations: number;
  text: string;
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
      text: "",
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
      const server = this.findServerByName(serverHost);
      if (!server) {
        this.log(
          `⚠️  Warning: State file references unknown server "${serverHost}"`
        );
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
    summary.text = this.createDownloadSummary(summary);

    return summary;
  }

  private createDownloadSummary(summary: DownloadSummary) {
    const summaryLines = [
      "\n--- Download Summary ---",
      `Servers checked: ${summary.serversChecked}`,
      `Files downloaded: ${summary.filesDownloaded}`,
      `Files skipped: ${summary.filesSkipped}`,
      `Files still pending: ${summary.filesPending}`,
    ];
    if (summary.serversCompleted.length > 0) {
      summaryLines.push(
        `Servers completed: ${summary.serversCompleted.join(", ")}`
      );
    }
    if (summary.interruptedOperations > 0) {
      summaryLines.push(
        `⚠️ Interrupted operations: ${summary.interruptedOperations}`
      );
    }
    return summaryLines.join("\n");
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

  private findServerByName(serverName: string): ServerConfig | undefined {
    return this.serverConfigs.find((s) => s.serverName === serverName);
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
      server.serverName
    );
    const allDownloads = this.stateManager.getAllPendingDownloads(
      server.serverName
    );

    if (waitingDownloads.length === 0 && allDownloads.length > 0) {
      this.log(
        `Server ${server.serverName}: No waiting downloads (all completed/interrupted)`
      );

      if (this.stateManager.areAllDownloadsCompleted(server.serverName)) {
        await this.cleanupInputFilesOnServer(server);
        result.allCompleted = true;
      }

      return result;
    }

    this.log(
      `\nServer ${server.serverName}: Checking ${waitingDownloads.length} file(s)...`
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
        const progressBar = createProgressBar();

        await this.downloadReadyFile(server, download, progressBar.show);

        progressBar.finish();
        result.downloaded++;
        this.log(`  ✓ Downloaded: ${basename(download.outputFile)}`);
      } catch (error) {
        this.log(`  ✗ Failed to download: ${basename(download.outputFile)}`);
        console.error(error);
        result.skipped++;
      }
    }

    if (this.stateManager.areAllDownloadsCompleted(server.serverName)) {
      await this.cleanupInputFilesOnServer(server);
      result.allCompleted = true;
    }

    return result;
  }

  private async downloadReadyFile(
    server: ServerConfig,
    download: PendingDownload,
    onProgress?: (progress: any) => void
  ): Promise<void> {
    await this.stateManager.markDownloadInProgress(
      server.serverName,
      download.outputFile
    );

    try {
      await this.fileOperations.downloadFileAndCleanup(
        server,
        download.remoteFile,
        download.outputFile,
        onProgress
      );

      await this.stateManager.markDownloadCompleted(
        server.serverName,
        download.outputFile
      );
    } catch (error) {
      await this.stateManager.markDownloadInterrupted(
        server.serverName,
        download.outputFile
      );
      throw error;
    }
  }

  private async cleanupInputFilesOnServer(server: ServerConfig): Promise<void> {
    const inputFiles = this.stateManager.getAllUploadedInputFiles(
      server.serverName
    );

    if (inputFiles.length === 0) {
      this.log(`Server ${server.serverName}: No input files to clean up`);
      await this.stateManager.removeServerState(server.serverName);
      return;
    }

    this.log(
      `Server ${server.serverName}: Cleaning up ${inputFiles.length} input file(s)...`
    );

    const removalResult = await this.fileOperations.removeRemoteFiles(
      server,
      inputFiles.map((i) => i.remoteFile)
    );
    if (removalResult.removals > 0) {
      this.log(`  ✓ Removed ${removalResult.removals} input file(s)`);
    }
    if (removalResult.failures.length > 0) {
      this.log(
        `  ⚠️ Failed to remove ${removalResult.failures.length} input file(s):`
      );
      for (const failure of removalResult.failures) {
        this.log(`    - ${failure.remoteFile}: ${failure.error}`);
      }
    }

    await this.stateManager.removeServerState(server.serverName);
  }
}

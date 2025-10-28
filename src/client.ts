import { config } from "@/infra/config";
import { SshFileOperations, SshClient } from "@/remote-job-dispatch";
import { ClientStateManager } from "@/remote-job-dispatch/core/client-state-manager";
import { DownloadManager } from "@/remote-job-dispatch/app/download-manager";
import { CommandDispatcher } from "@/remote-job-dispatch/app/command-dispatcher";

async function main() {
  if (!config.serverConfigs || config.serverConfigs.length === 0) {
    console.error("No server configurations found in config.toml");
    process.exit(1);
  }

  const remoteClient = new SshClient();
  const fileOperations = new SshFileOperations(remoteClient);
  const stateManager = await ClientStateManager.create(config.clientStateFile);

  await processPendingDownloads(fileOperations, stateManager);
  await dispatchNewCommands(fileOperations, stateManager);
}

async function dispatchNewCommands(
  fileOperations: SshFileOperations,
  stateManager: ClientStateManager
) {
  console.log("\n=== Dispatching new commands ===");
  const commandDispatcher = new CommandDispatcher({
    fileOperations,
    stateManager,
    cmdsInputDir: config.cmdsInputDir,
    serverConfigs: config.serverConfigs,
  });
  const dispatchSummary = await commandDispatcher.dispatchAllCommands();

  console.log("\n--- Dispatch Summary ---");
  console.log(
    `Command files processed: ${dispatchSummary.commandFilesProcessed}`
  );
  console.log(`Command files skipped: ${dispatchSummary.commandFilesSkipped}`);
  if (dispatchSummary.serversDispatched.length > 0) {
    console.log(
      `Servers dispatched to: ${dispatchSummary.serversDispatched.join(", ")}`
    );
  }
  console.log(
    `Total input files uploaded: ${dispatchSummary.totalInputFilesUploaded}`
  );
  console.log(
    `Total output files expected: ${dispatchSummary.totalOutputFilesExpected}`
  );
  if (dispatchSummary.errors.length > 0) {
    console.log(`\n⚠️ Errors encountered:`);
    dispatchSummary.errors.forEach((err) => console.log(`  - ${err}`));
  }

  console.log("\n=== Client finished successfully ===");
}

async function processPendingDownloads(
  fileOperations: SshFileOperations,
  stateManager: ClientStateManager
) {
  console.log("=== Checking for completed outputs ===");
  const downloadManager = new DownloadManager({
    fileOperations,
    stateManager,
    serverConfigs: config.serverConfigs,
  });
  const downloadSummary = await downloadManager.processAllPendingDownloads();

  console.log("\n--- Download Summary ---");
  console.log(`Servers checked: ${downloadSummary.serversChecked}`);
  console.log(`Files downloaded: ${downloadSummary.filesDownloaded}`);
  console.log(`Files skipped: ${downloadSummary.filesSkipped}`);
  console.log(`Files still pending: ${downloadSummary.filesPending}`);
  if (downloadSummary.serversCompleted.length > 0) {
    console.log(
      `Servers completed: ${downloadSummary.serversCompleted.join(", ")}`
    );
  }
  if (downloadSummary.interruptedOperations > 0) {
    console.log(
      `⚠️ Interrupted operations: ${downloadSummary.interruptedOperations}`
    );
  }
}

main().catch((error) => {
  console.error("Fatal error in client execution:", error);
  process.exit(1);
});

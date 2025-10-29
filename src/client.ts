import { config } from "@/infra/config";
import { SshClient, SshFileOperations } from "@/remote-job-dispatch";
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
  const stateManager = await ClientStateManager.create(
    config.clientStateFile,
    config.serverConfigs
  );

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
  console.log(dispatchSummary.text);
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
  console.log(downloadSummary.text);
}

main().catch((error) => {
  console.error("Fatal error in client execution:", error);
  process.exit(1);
});

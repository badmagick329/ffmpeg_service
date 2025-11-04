import { config } from "@/infra/config";
import { SshCommandExecutor, SshFileOperations } from "@/remote-job-dispatch";
import { ClientStateManager } from "@/remote-job-dispatch/core/client-state-manager";
import { DownloadManager } from "@/remote-job-dispatch/app/download-manager";
import { CommandDispatcher } from "@/remote-job-dispatch/app/command-dispatcher";
import { SftpTransferClient } from "@/remote-job-dispatch/infra/sftp-transfer-client";
import { ClientStateJsonStorage } from "@/remote-job-dispatch/infra/client-state-json-storage";

async function main() {
  if (!config.serverConfigs || config.serverConfigs.length === 0) {
    console.error("No server configurations found in config.toml");
    process.exit(1);
  }

  const transferClient = new SftpTransferClient();
  const sshCommandExecutor = new SshCommandExecutor();
  const fileOperations = new SshFileOperations(
    sshCommandExecutor,
    transferClient
  );

  const stateStorage = new ClientStateJsonStorage(config.clientStateFile);
  const stateManager = await ClientStateManager.create(
    config.serverConfigs,
    stateStorage
  );

  await processPendingDownloads(fileOperations, stateManager);
  await dispatchNewCommands(fileOperations, stateManager);
  await promptForInputFileCleanup(fileOperations, stateManager);
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

async function promptForInputFileCleanup(
  fileOperations: SshFileOperations,
  stateManager: ClientStateManager
) {
  console.log("\n=== Checking for unused input files ===");
  let unusedInputFilesOnServers =
    await stateManager.getUnusedInputFilesOnServers(config.serverConfigs);

  if (unusedInputFilesOnServers.length === 0) {
    console.log("No unused input files found.");
    return;
  }
  for (const unusedInputFilesOnServer of unusedInputFilesOnServers) {
    console.log(
      `Server: ${
        unusedInputFilesOnServer.server.serverName ||
        unusedInputFilesOnServer.server.sshHostIP
      }`
    );
    for (const inputFile of unusedInputFilesOnServer.uploadedInputFiles) {
      console.log(`  - ${inputFile.remoteFile}`);
    }
  }
  const yes =
    prompt(
      "Remove the above input files which are no longer being used? [y/N] "
    )?.trim() === "y";
  if (yes) {
    for (const result of unusedInputFilesOnServers) {
      await fileOperations.removeFiles(
        result.server,
        result.uploadedInputFiles.map((i) => i.remoteFile)
      );
    }
  }
}

main().catch((error) => {
  console.error("Fatal error in client execution:", error);
  process.exit(1);
});

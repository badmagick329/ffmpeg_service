import { config } from "@/infra/config";
import { SshCommandExecutor, SshFileOperations } from "@/remote-job-dispatch";
import { ClientStateManager } from "@/remote-job-dispatch/core/client-state-manager";
import { DownloadManager } from "@/remote-job-dispatch/app/download-manager";
import { CommandDispatcher } from "@/remote-job-dispatch/app/command-dispatcher";
import { SftpTransferClient } from "@/remote-job-dispatch/infra/sftp-transfer-client";
import { ClientStateJsonStorage } from "@/remote-job-dispatch/infra/client-state-json-storage";
import type { RemovalsSummary } from "@/remote-job-dispatch/core/ifile-operations";
import { RemoteFileCleanup } from "@/remote-job-dispatch/app/remote-file-cleanup";

async function main() {
  if (!config.remoteConfigs || config.remoteConfigs.length === 0) {
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
    config.remoteConfigs,
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
    serverConfigs: config.remoteConfigs,
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
    serverConfigs: config.remoteConfigs,
  });
  const dispatchSummary = await commandDispatcher.dispatchAllCommands();
  console.log(dispatchSummary.text);
}

async function promptForInputFileCleanup(
  fileOperations: SshFileOperations,
  stateManager: ClientStateManager
) {
  console.log("\n=== Checking for unused input files ===");
  const remoteFileCleanup = new RemoteFileCleanup(
    fileOperations,
    stateManager,
    config.remoteConfigs
  );
  const { remoteFilesByServer, errorsByServer } =
    await remoteFileCleanup.fetchRemoteInputFiles();

  for (const [server, error] of Object.entries(errorsByServer)) {
    console.error(`Error fetching remote files from ${server}: ${error}`);
  }

  const filesToRemove = await remoteFileCleanup.findFilesToRemove(
    remoteFilesByServer
  );

  if (filesToRemove.length === 0) {
    console.log("No unused input files found.");
    return;
  }

  filesToRemove.forEach((files) => {
    console.log(`Server: ${files.server.serverName || files.server.sshHostIP}`);
    files.uploadedInputFiles.forEach((f) => console.log(`  - ${f.remoteFile}`));
  });

  const yes =
    prompt(
      "Remove the above input file(s) which are no longer being used? [y/N] "
    )?.trim() === "y";
  if (!yes) {
    return;
  }

  const removalSummary: RemovalsSummary = { removals: 0, failures: [] };
  for (const fileToRemove of filesToRemove) {
    const summary = await fileOperations.removeFiles(
      fileToRemove.server,
      fileToRemove.uploadedInputFiles.map((i) => i.remoteFile)
    );
    removalSummary.removals += summary.removals;
    removalSummary.failures.push(...summary.failures);
  }

  console.log(
    `Removed ${removalSummary.removals} input files.${
      removalSummary.failures.length > 0
        ? ` ${removalSummary.failures} failure(s).`
        : ""
    }`
  );
  removalSummary.failures.forEach((f) => {
    console.error(`Failed to remove ${f.remoteFile}: ${f.error}`);
  });
}

main().catch((error) => {
  console.error("Fatal error in client execution:", error);
  process.exit(1);
});

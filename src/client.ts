import { config } from "@/infra/config";
import { SshCommandExecutor, SshFileOperations } from "@/remote-job-dispatch";
import { ClientStateManager } from "@/remote-job-dispatch/core/client-state-manager";
import { DownloadManager } from "@/remote-job-dispatch/app/download-manager";
import { CommandDispatcher } from "@/remote-job-dispatch/app/command-dispatcher";
import { SftpTransferClient } from "@/remote-job-dispatch/infra/sftp-transfer-client";
import { ClientStateJsonStorage } from "@/remote-job-dispatch/infra/client-state-json-storage";
import { basename } from "node:path";
import type { RemovalsSummary } from "@/remote-job-dispatch/core/ifile-operations";

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
  const inputFilesOnServerQueryResult = config.serverConfigs.map(
    async (server) =>
      (await fileOperations.getRemoteInputFiles(server)).map((files) => {
        return { server, files };
      })
  );
  const inputFilesOnServersResult = await Promise.all(
    inputFilesOnServerQueryResult
  );
  inputFilesOnServersResult
    .filter((r) => r.isFailure)
    .forEach((e) => {
      console.error("Error querying remote input files:", e.unwrapError());
    });

  const inputFilesOnServers = inputFilesOnServersResult
    .filter((r) => r.isSuccess)
    .map((r) => {
      const { server, files } = r.unwrap();
      return {
        [server.serverName || server.sshHostIP]: new Set(files),
      };
    })
    .reduce((a, b) => ({ ...a, ...b }), {});

  unusedInputFilesOnServers = unusedInputFilesOnServers.map((f) => {
    const filesOnServer =
      inputFilesOnServers[f.server.serverName || f.server.sshHostIP];
    return {
      server: f.server,
      uploadedInputFiles: f.uploadedInputFiles.filter((i) =>
        filesOnServer?.has(basename(i.remoteFile))
      ),
    };
  });

  if (unusedInputFilesOnServers.length === 0) {
    console.log("No unused input files found.");
    return;
  }

  unusedInputFilesOnServers.forEach((i) => {
    console.log(`Server: ${i.server.serverName || i.server.sshHostIP}`);
    i.uploadedInputFiles.forEach((f) => console.log(`  - ${f.remoteFile}`));
  });

  const yes =
    prompt(
      "Remove the above input files which are no longer being used? [y/N] "
    )?.trim() === "y";
  if (yes) {
    const removalSummary: RemovalsSummary = { removals: 0, failures: [] };
    for (const unusedInputFilesOnServer of unusedInputFilesOnServers) {
      const summary = await fileOperations.removeFiles(
        unusedInputFilesOnServer.server,
        unusedInputFilesOnServer.uploadedInputFiles.map((i) => i.remoteFile)
      );
      removalSummary.removals += summary.removals;
      removalSummary.failures.push(...summary.failures);
    }

    console.log(
      `Removed ${removalSummary.removals} input files.${
        removalSummary.failures.length > 0
          ? ` ${removalSummary.failures} failures.`
          : ""
      }`
    );
    removalSummary.failures.forEach((f) => {
      console.error(`Failed to remove ${f.remoteFile}: ${f.error}`);
    });
  }
}

main().catch((error) => {
  console.error("Fatal error in client execution:", error);
  process.exit(1);
});

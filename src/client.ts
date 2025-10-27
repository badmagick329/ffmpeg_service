import { config } from "@/infra/config";
import {
  CommandFileWatcher,
  RemoteJobDispatcher,
  SshFileOperations,
  SshClient,
} from "@/remote-job-dispatch";

async function main() {
  if (!config.serverConfigs || config.serverConfigs.length === 0) {
    console.error("No server configurations found in config.toml");
    console.error(
      "Please add [serverConfigs] section(s) to your config.toml file"
    );
    process.exit(1);
  }

  const remoteClient = new SshClient();
  const fileOperations = new SshFileOperations(remoteClient);
  const dispatcher = new RemoteJobDispatcher(
    fileOperations,
    config.localOutputDir
  );

  const watcher = new CommandFileWatcher(
    config.cmdsInputDir,
    config.serverConfigs,
    dispatcher
  );

  watcher.start();
}

main();

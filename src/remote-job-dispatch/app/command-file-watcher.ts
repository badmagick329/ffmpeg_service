import type { ServerConfig } from "@/infra/config";
import { FsWatcher } from "@/fs-watcher";
import { ServerSelector } from "@/remote-job-dispatch/core/server-selector";
import { RemoteJobDispatcher } from "@/remote-job-dispatch/app/remote-job-dispatcher";
import { readFileSync } from "fs";
import { basename } from "path";

export class CommandFileWatcher {
  private readonly log = console.log;
  private watcher: FsWatcher;
  private serverSelector: ServerSelector;

  constructor(
    private cmdsInputDir: string,
    private servers: ServerConfig[],
    private dispatcher: RemoteJobDispatcher
  ) {
    this.watcher = new FsWatcher(cmdsInputDir);
    this.serverSelector = new ServerSelector(servers);
  }

  start() {
    this.watcher.onAdd = async (filePath) => {
      this.log(`New command file detected: ${filePath}`);
      await this.processCommandFile(filePath);
    };

    this.watcher.onChange = async (filePath) => {
      this.log(`Command file updated: ${filePath}`);
      await this.processCommandFile(filePath);
    };

    this.watcher.onUnlink = (filePath) => {
      this.log(`Command file removed: ${filePath}`);
    };

    this.log(`Watching for command files in: ${this.cmdsInputDir}`);
    this.log(
      `Configured servers: ${this.servers.map((s) => s.sshHost).join(", ")}`
    );
    this.watcher.watch({});
  }

  private async processCommandFile(filePath: string) {
    this.log(`Processing command file: ${filePath}`);

    try {
      const commands = this.readCommands(filePath);
      if (commands.length === 0) {
        this.log("No valid commands found");
        return;
      }

      const server = this.serverSelector.selectServer(filePath);

      if (!server) {
        this.log(`No matching server found for file: ${basename(filePath)}`);
        this.log(
          `Available servers: ${this.servers.map((s) => s.sshHost).join(", ")}`
        );
        this.log(
          `File naming convention: include server hostname in filename (e.g., commands_${this.servers[0]?.sshHost}.txt)`
        );
        return;
      }

      this.log(`Targeting server: ${server.sshHost}`);

      try {
        await this.dispatcher.dispatch(server, commands, filePath);
        this.log(`✓ Server ${server.sshHost} completed successfully`);
      } catch (error) {
        console.error(`✗ Server ${server.sshHost} failed:`, error);
      }
    } catch (error) {
      console.error("Error processing command file:", error);
    }
  }

  private readCommands(filePath: string): string[] {
    const content = readFileSync(filePath, "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  }
}

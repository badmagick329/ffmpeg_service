import { config, type ServerConfig } from "@/infra/config";
import { FsWatcher } from "@/fs-watcher";
import { ParsedCmd } from "@/command-translation/parsed-cmd";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { basename, resolve } from "path";
import { $ } from "bun";

class FFmpegClient {
  private readonly log = console.log;
  private servers: ServerConfig[];
  private static POLLING_INTERVAL = 10000;

  constructor(servers: ServerConfig[]) {
    this.servers = servers;
  }

  async processCommandFile(filePath: string) {
    this.log(`Processing command file: ${filePath}`);

    try {
      const commands = this.readCommands(filePath);
      if (commands.length === 0) {
        this.log("No valid commands found");
        return;
      }

      const server = this.getTargetServers(filePath);

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
        await this.processForServer(server, commands, filePath);
        this.log(`✓ Server ${server.sshHost} completed successfully`);
      } catch (error) {
        console.error(`✗ Server ${server.sshHost} failed`);
      }
    } catch (error) {
      console.error("Error processing command file:", error);
    }
  }

  private getTargetServers(filePath: string): ServerConfig | undefined {
    const filename = basename(filePath);
    const filenameWithoutExt = filename.replace(/\.[^/.]+$/, "");

    for (const server of this.servers) {
      if (filenameWithoutExt.includes(server.sshHost)) {
        return server;
      }
    }
  }

  private async processForServer(
    server: ServerConfig,
    commands: string[],
    commandFilePath: string
  ) {
    this.log(`Processing for server: ${server.sshHost}`);

    try {
      const inputFiles = this.extractInputFiles(commands);
      await this.uploadInputFiles(server, inputFiles);
      await this.uploadCommandFile(server, commandFilePath);
      await this.waitAndDownloadResults(server, commands);
      await this.cleanupRemoteFiles(server, inputFiles);

      this.log(`Server ${server.sshHost} completed successfully`);
    } catch (error) {
      console.error(`Error processing for server ${server.sshHost}:`, error);
      throw error;
    }
  }

  private readCommands(filePath: string): string[] {
    const content = readFileSync(filePath, "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  }

  private extractInputFiles(commands: string[]): string[] {
    const inputFiles: string[] = [];

    for (const cmd of commands) {
      try {
        const parsed = ParsedCmd.create(cmd);
        const inputFile = resolve(parsed.input);

        if (existsSync(inputFile)) {
          inputFiles.push(inputFile);
        } else {
          this.log(`Warning: Input file not found: ${inputFile}`);
        }
      } catch (error) {
        this.log(`Warning: Could not parse command: ${cmd}`);
      }
    }

    return [...new Set(inputFiles)];
  }

  private async uploadInputFiles(server: ServerConfig, inputFiles: string[]) {
    if (inputFiles.length === 0) {
      return;
    }

    this.log(
      `Uploading ${inputFiles.length} input files to ${server.sshHost}...`
    );

    const uploadPromises = inputFiles.map(async (file) => {
      const remoteFile = `${server.copyTo}/${basename(file)}`;
      await this.runScp(
        server,
        file,
        `${server.sshUser}@${server.sshHost}:${remoteFile}`
      );
      return file;
    });

    const results = await Promise.allSettled(uploadPromises);
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected");

    if (failed.length > 0) {
      this.log(
        `Warning: ${failed.length}/${inputFiles.length} uploads failed to ${server.sshHost}`
      );
      failed.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(
            `Failed to upload ${inputFiles[index]}:`,
            result.reason
          );
        }
      });
    }

    this.log(
      `${successful}/${inputFiles.length} input files uploaded to ${server.sshHost}`
    );
  }

  private async uploadCommandFile(server: ServerConfig, filePath: string) {
    this.log(`Uploading command file to ${server.sshHost}...`);

    const remoteFile = `${server.remoteCmdsDir}/${basename(filePath)}`;
    await this.runScp(
      server,
      filePath,
      `${server.sshUser}@${server.sshHost}:${remoteFile}`
    );

    this.log(`Command file uploaded to ${server.sshHost}`);
  }

  private async waitAndDownloadResults(
    server: ServerConfig,
    commands: string[]
  ) {
    this.log(`Waiting for jobs to complete on ${server.sshHost}...`);

    const outputFiles = this.extractOutputFiles(commands);
    const completedFiles: string[] = [];

    while (completedFiles.length < outputFiles.length) {
      await Bun.sleep(FFmpegClient.POLLING_INTERVAL);

      for (const outputFile of outputFiles) {
        if (completedFiles.includes(outputFile)) continue;

        const remoteFile = `${server.copyFrom}/${basename(outputFile)}`;
        const fileExists = await this.checkRemoteFileExists(server, remoteFile);

        if (fileExists) {
          const isStable = await this.isFileStable(server, remoteFile);

          if (isStable) {
            this.log(
              `Downloading file from ${server.sshHost}: ${basename(outputFile)}`
            );
            const localFile = resolve(
              config.localOutputDir,
              basename(outputFile)
            );
            await this.runScp(
              server,
              `${server.sshUser}@${server.sshHost}:${remoteFile}`,
              localFile
            );

            await this.runSsh(server, `rm "${remoteFile}"`);
            completedFiles.push(outputFile);
          } else {
            this.log(
              `File ${basename(
                outputFile
              )} exists but is still being written to on ${server.sshHost}`
            );
          }
        }
      }

      if (completedFiles.length < outputFiles.length) {
        this.log(
          `${server.sshHost} - Completed: ${completedFiles.length}/${outputFiles.length} files`
        );
      }
    }

    this.log(`All files downloaded from ${server.sshHost}`);
  }

  private extractOutputFiles(commands: string[]): string[] {
    const outputFiles: string[] = [];

    for (const cmd of commands) {
      try {
        const parsed = ParsedCmd.create(cmd);
        outputFiles.push(parsed.output);
      } catch (error) {
        console.error(`Could not parse command for output file: ${cmd}`);
      }
    }

    return outputFiles;
  }

  private async cleanupRemoteFiles(server: ServerConfig, inputFiles: string[]) {
    this.log(`Cleaning up remote input files on ${server.sshHost}...`);

    const cleanupPromises = inputFiles.map(async (file) => {
      const remoteFile = `${server.copyTo}/${basename(file)}`;
      await this.runSsh(server, `rm -f "${remoteFile}"`);
      return file;
    });

    const results = await Promise.allSettled(cleanupPromises);
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed > 0) {
      this.log(
        `Warning: ${failed}/${inputFiles.length} cleanup operations failed on ${server.sshHost}`
      );
    } else {
      this.log(`Cleanup completed on ${server.sshHost}`);
    }
  }

  private async checkRemoteFileExists(
    server: ServerConfig,
    remoteFile: string
  ): Promise<boolean> {
    try {
      await this.runSsh(server, `test -f "${remoteFile}"`);
      return true;
    } catch {
      return false;
    }
  }

  private async isFileStable(
    server: ServerConfig,
    remoteFile: string
  ): Promise<boolean> {
    try {
      const size1 = await this.runSsh(
        server,
        `stat -c%s "${remoteFile}" 2>/dev/null || echo "0"`
      );
      await Bun.sleep(3000);
      const size2 = await this.runSsh(
        server,
        `stat -c%s "${remoteFile}" 2>/dev/null || echo "0"`
      );

      const sizeStable = size1.trim() === size2.trim() && size1.trim() !== "0";

      if (!sizeStable) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private async runSsh(server: ServerConfig, command: string): Promise<string> {
    const sshArgs = [
      ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
      "-o",
      "StrictHostKeyChecking=no",
      `${server.sshUser}@${server.sshHost}`,
      command,
    ];

    const result = await $`ssh ${sshArgs}`.text();
    return result;
  }

  private async runScp(
    server: ServerConfig,
    source: string,
    destination: string
  ): Promise<void> {
    const scpArgs = [
      ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
      "-o",
      "StrictHostKeyChecking=no",
      source,
      destination,
    ];

    await $`scp ${scpArgs}`;
  }
}

async function main() {
  if (!config.serverConfigs || config.serverConfigs.length === 0) {
    console.error("No server configurations found in config.toml");
    console.error(
      "Please add [serverConfigs] section(s) to your config.toml file"
    );
    process.exit(1);
  }

  const client = new FFmpegClient(config.serverConfigs);

  const watcher = new FsWatcher(config.cmdsInputDir);

  watcher.onAdd = async (filePath) => {
    console.log(`New command file detected: ${filePath}`);
    await client.processCommandFile(filePath);
  };

  watcher.onChange = async (filePath) => {
    console.log(`Command file updated: ${filePath}`);
    await client.processCommandFile(filePath);
  };

  watcher.onUnlink = (filePath) => {
    console.log(`Command file removed: ${filePath}`);
  };

  console.log(`Watching for command files in: ${config.cmdsInputDir}`);
  console.log(
    `Configured servers: ${config.serverConfigs
      .map((s) => s.sshHost)
      .join(", ")}`
  );
  watcher.watch({});
}

main();

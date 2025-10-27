import type { ServerConfig } from "@/infra/config";
import type { IFileOperations } from "@/remote-job-dispatch/core/ifile-operations";
import { ParsedCmd } from "@/command-translation/parsed-cmd";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";

export class RemoteJobDispatcher {
  private readonly log = console.log;
  private static POLLING_INTERVAL = 10000;

  constructor(
    private fileOperations: IFileOperations,
    private localOutputDir: string
  ) {}

  async dispatch(
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

    let skipped = 0;
    const uploadPromises = inputFiles.map(async (file) => {
      const remoteFile = `${server.copyTo}/${basename(file)}`;

      const shouldUpload = await this.fileOperations.shouldUploadFile(
        server,
        file,
        remoteFile
      );
      if (!shouldUpload) {
        this.log(
          `Skipping ${basename(file)} - already exists with matching size on ${
            server.sshHost
          }`
        );
        skipped++;
        return file;
      }

      await this.fileOperations.uploadFile(server, file, remoteFile);
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

    const uploaded = successful - skipped;
    this.log(
      `${uploaded} uploaded, ${skipped} skipped, ${inputFiles.length} total for ${server.sshHost}`
    );
  }

  private async uploadCommandFile(server: ServerConfig, filePath: string) {
    this.log(`Uploading command file to ${server.sshHost}...`);

    const remoteFile = `${server.remoteCmdsDir}/${basename(filePath)}`;
    await this.fileOperations.uploadFile(server, filePath, remoteFile);

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
      await Bun.sleep(RemoteJobDispatcher.POLLING_INTERVAL);

      for (const outputFile of outputFiles) {
        if (completedFiles.includes(outputFile)) {
          continue;
        }

        const isReady = await this.fileOperations.isFileReadyForDownload(
          server,
          outputFile
        );
        if (!isReady) {
          continue;
        }

        const remoteFile = `${server.copyFrom}/${basename(outputFile)}`;
        this.log(
          `Downloading file from ${server.sshHost}: ${basename(outputFile)}`
        );
        const localFile = resolve(this.localOutputDir, basename(outputFile));
        await this.fileOperations.downloadFileAndCleanup(
          server,
          remoteFile,
          localFile
        );

        completedFiles.push(outputFile);
      }

      if (completedFiles.length < outputFiles.length) {
        this.log(
          `[${new Date().toISOString().split("Z")[0]?.replace("T", " ")}] - ${
            server.sshHost
          } - Completed: ${completedFiles.length}/${outputFiles.length} files`
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
      await this.fileOperations.removeFile(server, remoteFile);
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
}

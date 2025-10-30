import type { ServerConfig } from "@/infra/config";
import type { IFileOperations } from "@/remote-job-dispatch/core/ifile-operations";
import type {
  IRemoteClient,
  ProgressCallback,
} from "@/remote-job-dispatch/core/iremote-client";
import { basename } from "path";

export class SshFileOperations implements IFileOperations {
  private readonly log = console.log;

  constructor(private remoteClient: IRemoteClient) {}

  async uploadFile(
    server: ServerConfig,
    localPath: string,
    remotePath: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    await this.remoteClient.upload(server, localPath, remotePath, onProgress);
  }

  async downloadFileAndCleanup(
    server: ServerConfig,
    remotePath: string,
    localPath: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    if (!(await this.checkFileExists(server, remotePath))) {
      this.log(`Remote file does not exist: ${remotePath}`);
      return;
    }

    await this.remoteClient.download(server, remotePath, localPath, onProgress);
    await this.removeFile(server, remotePath);
    const successFile = `${server.remoteSuccessDir}/${basename(
      remotePath
    )}.done`;
    await this.removeFile(server, successFile);
  }

  async checkFileExists(
    server: ServerConfig,
    remotePath: string
  ): Promise<boolean> {
    try {
      const escapedPath = remotePath.replace(/'/g, "'\\''");
      const command = `test -f '${escapedPath}'`;
      await this.remoteClient.execute(server, command);
      return true;
    } catch {
      return false;
    }
  }

  async shouldUploadFile(
    server: ServerConfig,
    localPath: string,
    remotePath: string
  ): Promise<boolean> {
    try {
      const exists = await this.checkFileExists(server, remotePath);
      if (!exists) {
        return true;
      }

      const localSize = Bun.file(localPath).size.toString();

      const escapedPath = remotePath.replace(/'/g, "'\\''");
      const remoteSize = (
        await this.remoteClient.execute(
          server,
          `stat -c%s '${escapedPath}' 2>/dev/null || echo "0"`
        )
      ).trim();

      if (localSize !== remoteSize) {
        this.log(
          `Size mismatch for ${basename(
            localPath
          )}: local=${localSize}, remote=${remoteSize}`
        );
        return true;
      }

      return false;
    } catch (error) {
      this.log(
        `Error encountered while verifying ${basename(
          localPath
        )} on remote: ${error}`
      );
      return true;
    }
  }

  async isFileReadyForDownload(
    server: ServerConfig,
    outputFile: string
  ): Promise<boolean> {
    const remoteFile = `${server.copyFrom}/${basename(outputFile)}`;
    const successFile = `${server.remoteSuccessDir}/${basename(
      remoteFile
    )}.done`;

    const successExists = await this.checkFileExists(server, successFile);
    if (!successExists) {
      return false;
    }

    const fileExists = await this.checkFileExists(server, remoteFile);
    if (!fileExists) {
      return false;
    }

    return true;
  }

  async removeFile(
    server: ServerConfig,
    remoteFile: string
  ): Promise<
    | {
        remoteFile: string;
        error: string;
      }
    | undefined
  > {
    try {
      const escapedPath = remoteFile.replace(/'/g, "'\\''");
      await this.remoteClient.execute(server, `rm -f '${escapedPath}'`);
    } catch (error) {
      return {
        remoteFile,
        error: String(error),
      };
    }
  }

  async removeRemoteFiles(
    server: ServerConfig,
    remoteFiles: string[]
  ): Promise<{
    removals: number;
    failures: {
      remoteFile: string;
      error: string;
    }[];
  }> {
    let removals = 0;
    const failures = [] as { remoteFile: string; error: string }[];

    for (const remoteFile of remoteFiles) {
      const removalError = await this.removeFile(server, remoteFile);
      if (!removalError) {
        removals++;
        continue;
      }
      failures.push(removalError);
    }
    return { removals, failures };
  }
}

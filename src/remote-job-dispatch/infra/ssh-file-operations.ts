import type { ServerConfig } from "@/infra/config";
import type { IFileOperations } from "@/remote-job-dispatch/core/ifile-operations";
import type { IRemoteClient } from "@/remote-job-dispatch/core/iremote-client";
import { basename } from "path";
import { filenameWithoutExt } from "@/common/path-utils";

export class SshFileOperations implements IFileOperations {
  private readonly log = console.log;

  constructor(private remoteClient: IRemoteClient) {}

  async uploadFile(
    server: ServerConfig,
    localPath: string,
    remotePath: string
  ): Promise<void> {
    await this.remoteClient.copyToServer(server, localPath, remotePath);
  }

  async downloadFileAndCleanup(
    server: ServerConfig,
    remotePath: string,
    localPath: string
  ): Promise<void> {
    const remoteFile = `${server.sshUser}@${server.sshHost}:${remotePath}`;
    if (!(await this.checkFileExists(server, remotePath))) {
      this.log(`Remote file does not exist: ${remotePath}`);
      return;
    }

    await this.remoteClient.copyFromServer(server, remoteFile, localPath);
    await this.removeFile(server, remotePath);
    const filename = filenameWithoutExt(remotePath);
    if (!filename) {
      this.log(`Could not extract filename from output path: ${remotePath}`);
      return;
    }
    const successFile = `${server.remoteSuccessDir}/${filename}`;
    await this.removeFile(server, successFile);
  }

  async checkFileExists(
    server: ServerConfig,
    remotePath: string
  ): Promise<boolean> {
    try {
      await this.remoteClient.execute(server, `test -f "${remotePath}"`);
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

      const localSize = (await Bun.file(localPath).size).toString();

      const remoteSize = (
        await this.remoteClient.execute(
          server,
          `stat -c%s "${remotePath}" 2>/dev/null || echo "0"`
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
    const fileExists = await this.checkFileExists(server, remoteFile);
    if (!fileExists) {
      return false;
    }

    const filename = filenameWithoutExt(remoteFile);
    if (!filename) {
      this.log(`Could not extract filename from output path: ${remoteFile}`);
      return false;
    }
    const successFile = `${server.remoteSuccessDir}/${filename}`;
    const successExists = await this.checkFileExists(server, successFile);
    if (!successExists) {
      return false;
    }
    return true;
  }

  async removeFile(server: ServerConfig, remoteFile: string): Promise<void> {
    try {
      await this.remoteClient.execute(server, `rm -f "${remoteFile}"`);
    } catch (error) {
      this.log(`Warning: Failed to delete remote file ${remoteFile}: ${error}`);
    }
  }

  private async isFileStable(
    server: ServerConfig,
    remotePath: string
  ): Promise<boolean> {
    try {
      const size1 = await this.remoteClient.execute(
        server,
        `stat -c%s "${remotePath}" 2>/dev/null || echo "0"`
      );
      await Bun.sleep(3000);
      const size2 = await this.remoteClient.execute(
        server,
        `stat -c%s "${remotePath}" 2>/dev/null || echo "0"`
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
}

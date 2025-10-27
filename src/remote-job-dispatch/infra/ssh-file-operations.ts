import type { ServerConfig } from "@/infra/config";
import type { IFileOperations } from "@/remote-job-dispatch/core/ifile-operations";
import type { IRemoteExecutor } from "@/remote-job-dispatch/core/iremote-executor";
import { $ } from "bun";
import { basename } from "path";

export class SshFileOperations implements IFileOperations {
  private readonly log = console.log;

  constructor(private remoteExecutor: IRemoteExecutor) {}

  async uploadFile(
    server: ServerConfig,
    localPath: string,
    remotePath: string
  ): Promise<void> {
    const scpArgs = [
      ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
      "-o",
      "StrictHostKeyChecking=no",
      localPath,
      `${server.sshUser}@${server.sshHost}:${remotePath}`,
    ];

    await $`scp ${scpArgs}`;
  }

  async downloadFileAndCleanup(
    server: ServerConfig,
    remotePath: string,
    localPath: string
  ): Promise<void> {
    const remoteFile = `${server.sshUser}@${server.sshHost}:${remotePath}`;
    const scpArgs = [
      ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
      "-o",
      "StrictHostKeyChecking=no",
      remoteFile,
      localPath,
    ];

    await $`scp ${scpArgs}`;
    await this.removeFile(server, remotePath);
  }

  async checkFileExists(
    server: ServerConfig,
    remotePath: string
  ): Promise<boolean> {
    try {
      await this.remoteExecutor.execute(server, `test -f "${remotePath}"`);
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
        await this.remoteExecutor.execute(
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

    return await this.isFileStable(server, remoteFile);
  }

  async removeFile(server: ServerConfig, remoteFile: string): Promise<void> {
    try {
      await this.remoteExecutor.execute(server, `rm -f "${remoteFile}"`);
    } catch (error) {
      this.log(`Warning: Failed to delete remote file ${remoteFile}: ${error}`);
    }
  }

  private async isFileStable(
    server: ServerConfig,
    remotePath: string
  ): Promise<boolean> {
    try {
      const size1 = await this.remoteExecutor.execute(
        server,
        `stat -c%s "${remotePath}" 2>/dev/null || echo "0"`
      );
      await Bun.sleep(3000);
      const size2 = await this.remoteExecutor.execute(
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

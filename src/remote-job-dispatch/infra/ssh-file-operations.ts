import type { RemoteConfig } from "@/infra/config";
import type { IFileOperations } from "@/remote-job-dispatch/core/ifile-operations";
import type { IRemoteCommandExecutor } from "@/remote-job-dispatch/core/iremote-executor";
import type {
  ITransferClient,
  ProgressCallback,
} from "@/remote-job-dispatch/core/itransfer-client";
import { basename } from "path";
import { tmpdir } from "os";
import { join } from "path";
import { Result } from "@/common/result";
import {
  DownloadError,
  RemoteFileNotFoundError,
  UploadError,
} from "@/remote-job-dispatch/core/errors/transfer-errors";
import { CommandExecutionError } from "@/remote-job-dispatch/core/errors";

export class SshFileOperations implements IFileOperations {
  private readonly log = console.log;

  constructor(
    private readonly sshCommandExecutor: IRemoteCommandExecutor,
    private readonly transferClient: ITransferClient
  ) {}

  async uploadFile(
    server: RemoteConfig,
    localPath: string,
    remotePath: string,
    onProgress?: ProgressCallback
  ): Promise<Result<void, UploadError>> {
    return await this.transferClient.upload(
      server,
      localPath,
      remotePath,
      onProgress
    );
  }

  async downloadFileAndCleanup(
    server: RemoteConfig,
    remotePath: string,
    localPath: string,
    onProgress?: ProgressCallback
  ): Promise<Result<void, DownloadError | RemoteFileNotFoundError>> {
    if (!(await this.checkFileExists(server, remotePath))) {
      this.log(`Remote file does not exist: ${remotePath}`);
      return Result.failure(new RemoteFileNotFoundError(remotePath));
    }

    const downloadResult = await this.transferClient.download(
      server,
      remotePath,
      localPath,
      onProgress
    );
    if (downloadResult.isFailure) {
      return downloadResult;
    }

    await this.removeFile(server, remotePath);
    const successFile = `${server.remoteSuccessDir}/${basename(remotePath)}.${
      server.successFlag
    }`;
    await this.removeFile(server, successFile);

    return Result.success(undefined);
  }

  async checkFileExists(
    server: RemoteConfig,
    remotePath: string
  ): Promise<boolean> {
    try {
      const escapedPath = remotePath.replace(/'/g, "'\\''");
      const command = `test -f '${escapedPath}'`;
      await this.sshCommandExecutor.execute(server, command);
      return true;
    } catch {
      return false;
    }
  }

  async shouldUploadFile(
    server: RemoteConfig,
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
        await this.sshCommandExecutor.execute(
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
    server: RemoteConfig,
    outputFile: string
  ): Promise<boolean> {
    const remoteFile = `${server.copyFrom}/${basename(outputFile)}`;
    const successFile = `${server.remoteSuccessDir}/${basename(remoteFile)}.${
      server.successFlag
    }`;

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

  async getFilesReadyForDownload(
    server: RemoteConfig
  ): Promise<Result<string[], CommandExecutionError>> {
    try {
      const executeResult = await this.sshCommandExecutor.execute(
        server,
        `ls ${server.remoteSuccessDir}`
      );

      return Result.success(
        executeResult
          .trim()
          .split("\n")
          .map((n) =>
            n.replace(new RegExp(`(.+)(\\.${server.successFlag}$)`), "$1")
          )
          .map((s) => s.trim())
          .filter((s) => s !== "")
      );
    } catch (error) {
      return Result.failure(new CommandExecutionError(String(error), server));
    }
  }

  async getRemoteInputFiles(
    server: RemoteConfig
  ): Promise<Result<string[], CommandExecutionError>> {
    try {
      const executeResult = await this.sshCommandExecutor.execute(
        server,
        `ls ${server.copyTo}`
      );

      return Result.success(
        executeResult
          .trim()
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s !== "")
      );
    } catch (error) {
      return Result.failure(new CommandExecutionError(String(error), server));
    }
  }

  async removeFile(
    server: RemoteConfig,
    remoteFile: string
  ): Promise<Result<void, Error>> {
    return await Result.fromThrowableAsync(async () => {
      const escapedPath = remoteFile.replace(/'/g, "'\\''");
      await this.sshCommandExecutor.execute(server, `rm -f '${escapedPath}'`);
    });
  }

  async removeFiles(
    server: RemoteConfig,
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
      const removeResult = await this.removeFile(server, remoteFile);
      if (removeResult.isFailure) {
        failures.push({
          remoteFile,
          error: String(removeResult.unwrapError()),
        });
        continue;
      }
      removals++;
    }
    return { removals, failures };
  }

  async writeFile(
    server: RemoteConfig,
    remotePath: string,
    content: string
  ): Promise<Result<void, Error>> {
    const tempFile = join(tmpdir(), "temp-file");
    return await Result.fromThrowableAsync(async () => {
      try {
        await Bun.file(tempFile).write(content);
        await this.uploadFile(server, tempFile, remotePath);
      } finally {
        await Bun.file(tempFile).delete();
      }
    });
  }
}

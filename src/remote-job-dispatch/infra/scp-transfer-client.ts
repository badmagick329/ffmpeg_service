import { Result } from "@/common/result";
import {
  DownloadError,
  UploadError,
} from "@/remote-job-dispatch/core/errors/transfer-errors";
import type { ServerConfig } from "@/infra/config";
import { $ } from "bun";

import type {
  ITransferClient,
  ProgressCallback,
} from "@/remote-job-dispatch/core/itransfer-client";

export class ScpTranferClient implements ITransferClient {
  async upload(
    server: ServerConfig,
    localFile: string,
    remoteFile: string,
    onProgress?: ProgressCallback
  ): Promise<Result<void, UploadError>> {
    const remoteTarget = remoteFile.includes(":")
      ? remoteFile
      : `${server.sshUser}@${server.sshHostIP}:${remoteFile}`;

    const scpArgs = [
      ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
      "-o",
      "StrictHostKeyChecking=no",
      localFile,
      remoteTarget,
    ];
    return (
      await Result.fromThrowableAsync(async () => {
        try {
          await $`scp ${scpArgs}`.text();
          // NOTE: scp doesn't provide progress, callback is ignored
        } catch (error) {
          console.error("SCP Error:", error);
          throw error;
        }
      })
    ).mapError((e) => new UploadError(localFile, remoteFile, e));
  }
  async download(
    server: ServerConfig,
    remoteFile: string,
    localFile: string,
    onProgress?: ProgressCallback
  ): Promise<Result<void, DownloadError>> {
    const remotePath = remoteFile.includes(":")
      ? remoteFile
      : `${server.sshUser}@${server.sshHostIP}:${remoteFile}`;

    const scpArgs = [
      ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
      "-o",
      "StrictHostKeyChecking=no",
      remotePath,
      localFile,
    ];

    return (
      await Result.fromThrowableAsync(async () => {
        try {
          await $`scp ${scpArgs}`.text();
          // NOTE: scp doesn't provide progress, callback is ignored
        } catch (error) {
          console.error("SCP Error:", error);
          throw error;
        }
      })
    ).mapError((e) => new DownloadError(localFile, remotePath, e));
  }
}

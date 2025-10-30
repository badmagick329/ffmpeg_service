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
  ): Promise<void> {
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

    try {
      await $`scp ${scpArgs}`.text();
      // NOTE: scp doesn't provide progress, callback is ignored
    } catch (error) {
      console.error("SCP Error:", error);
      throw error;
    }
  }
  async download(
    server: ServerConfig,
    remoteFile: string,
    localFile: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const remoteSource = remoteFile.includes(":")
      ? remoteFile
      : `${server.sshUser}@${server.sshHostIP}:${remoteFile}`;

    const scpArgs = [
      ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
      "-o",
      "StrictHostKeyChecking=no",
      remoteSource,
      localFile,
    ];

    try {
      await $`scp ${scpArgs}`.text();
      // NOTE: scp doesn't provide progress, callback is ignored
    } catch (error) {
      console.error("SCP Error:", error);
      throw error;
    }
  }
}

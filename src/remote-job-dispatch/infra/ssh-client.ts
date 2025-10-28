import type { ServerConfig } from "@/infra/config";
import type {
  IRemoteClient,
  ProgressCallback,
} from "@/remote-job-dispatch/core/iremote-client";
import { $ } from "bun";

/**
 * @deprecated Use Ssh2Client instead for progress tracking and better cross-platform support
 */
export class SshClient implements IRemoteClient {
  async execute(server: ServerConfig, command: string): Promise<string> {
    const sshArgs = [
      ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
      "-o",
      "StrictHostKeyChecking=no",
      "-o",
      "ConnectTimeout=15",
      `${server.sshUser}@${server.sshHostIP}`,
      command,
    ];

    const result = await $`ssh ${sshArgs}`.text();
    return result;
  }

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

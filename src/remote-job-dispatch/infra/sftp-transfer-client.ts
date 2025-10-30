import type { ServerConfig } from "@/infra/config";
import type {
  ITransferClient,
  ProgressCallback,
} from "@/remote-job-dispatch/core/itransfer-client";
import { $ } from "bun";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export class SftpTransferClient implements ITransferClient {
  constructor() {}

  async upload(
    server: ServerConfig,
    localFile: string,
    remoteFile: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const remotePath = remoteFile.includes(":")
      ? remoteFile.split(":")[1]
      : remoteFile;

    const batchFile = join(tmpdir(), `sftp-upload-${Date.now()}.txt`);
    const batchContent = `put "${localFile}" "${remotePath}"\nbye\n`;

    try {
      await writeFile(batchFile, batchContent);

      const sftpArgs = [
        ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
        "-o",
        "StrictHostKeyChecking=no",
        "-b",
        batchFile,
        `${server.sshUser}@${server.sshHostIP}`,
      ];

      await $`sftp ${sftpArgs}`.text();
      // NOTE: sftp command-line doesn't provide progress, callback is ignored
    } catch (error) {
      console.error("SFTP Upload Error:", error);
      throw error;
    } finally {
      try {
        await unlink(batchFile);
      } catch (e) {}
    }
  }

  async download(
    server: ServerConfig,
    remoteFile: string,
    localFile: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const remotePath = remoteFile.includes(":")
      ? remoteFile.split(":")[1]
      : remoteFile;

    const batchFile = join(tmpdir(), `sftp-download-${Date.now()}.txt`);
    const batchContent = `get "${remotePath}" "${localFile}"\nbye\n`;

    try {
      await writeFile(batchFile, batchContent);

      const sftpArgs = [
        ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
        "-o",
        "StrictHostKeyChecking=no",
        "-b",
        batchFile,
        `${server.sshUser}@${server.sshHostIP}`,
      ];

      await $`sftp ${sftpArgs}`.text();
      // NOTE: sftp command-line doesn't provide progress, callback is ignored
    } catch (error) {
      console.error("SFTP Download Error:", error);
      throw error;
    } finally {
      try {
        await unlink(batchFile);
      } catch (e) {}
    }
  }
}

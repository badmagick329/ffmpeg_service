import type { RemoteConfig } from "@/infra/config";
import type { IRemoteCommandExecutor } from "@/remote-job-dispatch/core/iremote-executor";

import { Client, type SFTPWrapper, type ClientChannel } from "ssh2";
import { basename } from "path";
import { createReadStream, createWriteStream } from "fs";
import { stat } from "fs/promises";
import { pipeline } from "stream/promises";
import type { ProgressCallback } from "@/remote-job-dispatch/core/itransfer-client";

export class Ssh2Client implements IRemoteCommandExecutor {
  private static readonly highWaterMark = 8 * 1024 * 1024;

  async execute(server: RemoteConfig, command: string): Promise<string> {
    const client = await this.connect(server);

    try {
      return await this.execCommand(client, command);
    } finally {
      client.end();
    }
  }

  async upload(
    server: RemoteConfig,
    localFile: string,
    remoteFile: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const client = await this.connect(server);

    try {
      const sftp = await this.getSftp(client);
      const remotePath = remoteFile.split(":")[1] || remoteFile;
      await this._upload(sftp, localFile, remotePath, onProgress);
    } finally {
      client.end();
    }
  }
  async download(
    server: RemoteConfig,
    remoteFile: string,
    localFile: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const client = await this.connect(server);

    try {
      const sftp = await this.getSftp(client);
      const remotePath = remoteFile.split(":")[1] || remoteFile;
      await this._download(sftp, remotePath, localFile, onProgress);
    } finally {
      client.end();
    }
  }

  private async connect(server: RemoteConfig): Promise<Client> {
    return new Promise((resolve, reject) => {
      const client = new Client();

      client.on("ready", () => resolve(client));
      client.on("error", reject);

      Bun.file(server.sshKeyPath)
        .text()
        .then((privateKey) => {
          const config = {
            host: server.sshHostIP,
            username: server.sshUser,
            readyTimeout: 30000,
            privateKey,
            keepaliveInterval: 10000,
            keepaliveCountMax: 3,
            algorithms: {
              compress: ["zlib@openssh.com", "zlib"] as [
                "zlib@openssh.com",
                "zlib"
              ],
            },
          };
          client.connect(config);
        })
        .catch(reject);
    });
  }

  private async getSftp(client: Client): Promise<SFTPWrapper> {
    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err);
        } else {
          resolve(sftp);
        }
      });
    });
  }

  private async execCommand(client: Client, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream: ClientChannel) => {
        if (err) {
          return reject(err);
        }

        let stdout = "";
        let stderr = "";

        stream.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on("close", (code: number) => {
          if (code !== 0) {
            reject(new Error(`Command failed (code ${code}): ${stderr}`));
          } else {
            resolve(stdout);
          }
        });
      });
    });
  }

  private async _upload(
    sftp: SFTPWrapper,
    localPath: string,
    remotePath: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const stats = await stat(localPath);
    const totalSize = stats.size;
    const filename = basename(localPath);
    let transferred = 0;

    const readStream = createReadStream(localPath, {
      highWaterMark: Ssh2Client.highWaterMark,
    });

    const writeStream = sftp.createWriteStream(remotePath, {
      highWaterMark: Ssh2Client.highWaterMark,
      autoClose: true,
    });

    readStream.on("data", (chunk: Buffer) => {
      transferred += chunk.length;

      if (onProgress) {
        onProgress({
          bytesTransferred: transferred,
          totalBytes: totalSize,
          percentage: Math.floor((transferred / totalSize) * 100),
          filename,
        });
      }
    });

    await pipeline(readStream, writeStream);

    if (onProgress) {
      onProgress({
        bytesTransferred: totalSize,
        totalBytes: totalSize,
        percentage: 100,
        filename,
      });
    }
  }

  private async _download(
    sftp: SFTPWrapper,
    remotePath: string,
    localPath: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const stats = await this.stat(sftp, remotePath);
    const totalSize = stats.size;
    const filename = basename(remotePath);
    let transferred = 0;

    const readStream = sftp.createReadStream(remotePath, {
      highWaterMark: Ssh2Client.highWaterMark,
      autoClose: true,
    });

    const writeStream = createWriteStream(localPath, {
      highWaterMark: Ssh2Client.highWaterMark,
    });

    readStream.on("data", (chunk: Buffer) => {
      transferred += chunk.length;

      if (onProgress) {
        onProgress({
          bytesTransferred: transferred,
          totalBytes: totalSize,
          percentage: Math.floor((transferred / totalSize) * 100),
          filename,
        });
      }
    });

    await pipeline(readStream, writeStream);

    if (onProgress) {
      onProgress({
        bytesTransferred: totalSize,
        totalBytes: totalSize,
        percentage: 100,
        filename,
      });
    }
  }

  private async stat(
    sftp: SFTPWrapper,
    remotePath: string
  ): Promise<{ size: number }> {
    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) reject(err);
        else resolve(stats);
      });
    });
  }
}

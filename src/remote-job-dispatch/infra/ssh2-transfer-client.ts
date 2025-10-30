import type { ServerConfig } from "@/infra/config";
import type {
  ITransferClient,
  ProgressCallback,
} from "@/remote-job-dispatch/core/itransfer-client";
import { Client, type SFTPWrapper } from "ssh2";
import { basename } from "path";
import { createReadStream, createWriteStream } from "fs";
import { stat } from "fs/promises";
import { pipeline } from "stream/promises";

export class Ssh2TransferClient implements ITransferClient {
  constructor(private readonly highWaterMark = 8 * 1024 * 1024) {}

  async upload(
    server: ServerConfig,
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
    server: ServerConfig,
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

  private async connect(server: ServerConfig): Promise<Client> {
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
      highWaterMark: this.highWaterMark,
    });

    const writeStream = sftp.createWriteStream(remotePath, {
      highWaterMark: this.highWaterMark,
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
      highWaterMark: this.highWaterMark,
      autoClose: true,
    });

    const writeStream = createWriteStream(localPath, {
      highWaterMark: this.highWaterMark,
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

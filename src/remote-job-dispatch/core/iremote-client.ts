import type { ServerConfig } from "@/infra/config";

export interface TransferProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  filename: string;
}

export type ProgressCallback = (progress: TransferProgress) => void;

export interface IRemoteClient {
  execute(server: ServerConfig, command: string): Promise<string>;
  upload(
    server: ServerConfig,
    localFile: string,
    remoteFile: string,
    onProgress?: ProgressCallback
  ): Promise<void>;
  download(
    server: ServerConfig,
    remoteFile: string,
    localFile: string,
    onProgress?: ProgressCallback
  ): Promise<void>;
}

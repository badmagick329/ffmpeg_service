import type { ServerConfig } from "@/infra/config";

export interface IFileOperations {
  uploadFile(
    server: ServerConfig,
    localPath: string,
    remotePath: string
  ): Promise<void>;

  downloadFileAndCleanup(
    server: ServerConfig,
    remotePath: string,
    localPath: string
  ): Promise<void>;

  checkFileExists(server: ServerConfig, remotePath: string): Promise<boolean>;

  shouldUploadFile(
    server: ServerConfig,
    localPath: string,
    remotePath: string
  ): Promise<boolean>;

  isFileReadyForDownload(
    server: ServerConfig,
    outputFile: string
  ): Promise<boolean>;

  removeFile(server: ServerConfig, remoteFile: string): Promise<void>;
}

import type { ServerConfig } from "@/infra/config";
import type { ProgressCallback } from "@/remote-job-dispatch/core/itransfer-client";

export interface IFileOperations {
  uploadFile(
    server: ServerConfig,
    localPath: string,
    remotePath: string,
    onProgress?: ProgressCallback
  ): Promise<void>;

  downloadFileAndCleanup(
    server: ServerConfig,
    remotePath: string,
    localPath: string,
    onProgress?: ProgressCallback
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

  removeFile(
    server: ServerConfig,
    remoteFile: string
  ): Promise<
    | {
        remoteFile: string;
        error: string;
      }
    | undefined
  >;
  removeRemoteFiles(
    server: ServerConfig,
    remoteFiles: string[]
  ): Promise<{
    removals: number;
    failures: {
      remoteFile: string;
      error: string;
    }[];
  }>;
}

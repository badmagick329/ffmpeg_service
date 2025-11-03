import type { Result } from "@/common/result";
import type { ServerConfig } from "@/infra/config";
import type { CommandExecutionError } from "@/remote-job-dispatch/core/errors";
import type {
  DownloadError,
  RemoteFileNotFoundError,
  UploadError,
} from "@/remote-job-dispatch/core/errors/transfer-errors";
import type { ProgressCallback } from "@/remote-job-dispatch/core/itransfer-client";

export interface IFileOperations {
  uploadFile(
    server: ServerConfig,
    localPath: string,
    remotePath: string,
    onProgress?: ProgressCallback
  ): Promise<Result<void, UploadError>>;

  downloadFileAndCleanup(
    server: ServerConfig,
    remotePath: string,
    localPath: string,
    onProgress?: ProgressCallback
  ): Promise<Result<void, DownloadError | RemoteFileNotFoundError>>;

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
  getFilesReadyForDownload(
    server: ServerConfig
  ): Promise<Result<string[], CommandExecutionError>>;

  removeFile(
    server: ServerConfig,
    remoteFile: string
  ): Promise<Result<void, Error>>;
  removeFiles(
    server: ServerConfig,
    remoteFiles: string[]
  ): Promise<{
    removals: number;
    failures: {
      remoteFile: string;
      error: string;
    }[];
  }>;

  writeFile(
    server: ServerConfig,
    remotePath: string,
    content: string
  ): Promise<Result<void, Error>>;
}

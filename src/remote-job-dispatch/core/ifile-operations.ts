import type { Result } from "@/common/result";
import type { RemoteConfig } from "@/infra/config";
import type { CommandExecutionError } from "@/remote-job-dispatch/core/errors";
import type {
  DownloadError,
  RemoteFileNotFoundError,
  UploadError,
} from "@/remote-job-dispatch/core/errors/transfer-errors";
import type { ProgressCallback } from "@/remote-job-dispatch/core/itransfer-client";

export type RemovalsSummary = {
  removals: number;
  failures: {
    remoteFile: string;
    error: string;
  }[];
};
export interface IFileOperations {
  uploadFile(
    server: RemoteConfig,
    localPath: string,
    remotePath: string,
    onProgress?: ProgressCallback
  ): Promise<Result<void, UploadError>>;

  downloadFileAndCleanup(
    server: RemoteConfig,
    remotePath: string,
    localPath: string,
    onProgress?: ProgressCallback
  ): Promise<Result<void, DownloadError | RemoteFileNotFoundError>>;

  checkFileExists(server: RemoteConfig, remotePath: string): Promise<boolean>;

  shouldUploadFile(
    server: RemoteConfig,
    localPath: string,
    remotePath: string
  ): Promise<boolean>;

  isFileReadyForDownload(
    server: RemoteConfig,
    outputFile: string
  ): Promise<boolean>;
  getFilesReadyForDownload(
    server: RemoteConfig
  ): Promise<Result<string[], CommandExecutionError>>;
  getRemoteInputFiles(
    server: RemoteConfig
  ): Promise<Result<string[], CommandExecutionError>>;

  removeFile(
    server: RemoteConfig,
    remoteFile: string
  ): Promise<Result<void, Error>>;
  removeFiles(
    server: RemoteConfig,
    remoteFiles: string[]
  ): Promise<{
    removals: number;
    failures: {
      remoteFile: string;
      error: string;
    }[];
  }>;

  writeFile(
    server: RemoteConfig,
    remotePath: string,
    content: string
  ): Promise<Result<void, Error>>;
}

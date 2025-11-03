import type { Result } from "@/common/result";
import type { ServerConfig } from "@/infra/config";
import type {
  UploadError,
  DownloadError,
} from "@/remote-job-dispatch/core/errors/transfer-errors";

export interface TransferProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  filename: string;
}

export type ProgressCallback = (progress: TransferProgress) => void;

export interface ITransferClient {
  upload(
    server: ServerConfig,
    localFile: string,
    remoteFile: string,
    onProgress?: ProgressCallback
  ): Promise<Result<void, UploadError>>;
  download(
    server: ServerConfig,
    remoteFile: string,
    localFile: string,
    onProgress?: ProgressCallback
  ): Promise<Result<void, DownloadError>>;
}

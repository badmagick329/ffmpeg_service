export class TransferError extends Error {
  constructor(message: string, public override readonly cause?: Error) {
    super(message);
    this.name = "TransferError";
  }
}

export class DownloadError extends TransferError {
  constructor(
    public readonly localPath: string,
    public readonly remotePath: string,
    public override readonly cause?: Error
  ) {
    super(`Failed to download ${remotePath} to ${localPath}`, cause);
    this.name = "DownloadError";
  }
}

export class UploadError extends TransferError {
  constructor(
    public readonly localPath: string,
    public readonly remotePath: string,
    public override readonly cause?: Error
  ) {
    super(`Failed to upload ${localPath} to ${remotePath}`, cause);
    this.name = "UploadError";
  }
}

export class RemoteFileNotFoundError extends TransferError {
  constructor(public readonly remotePath: string) {
    super(`Remote file not found: ${remotePath}`);
    this.name = "RemoteFileNotFound";
  }
}

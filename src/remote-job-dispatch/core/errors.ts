export class CommandDispatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandDispatchError";
  }
}

export class ServerSelectionError extends CommandDispatchError {
  constructor(
    public readonly filename: string,
    public readonly availableServers: string[]
  ) {
    super(`No matching server found for file: ${filename}`);
    this.name = "ServerSelectionError";
  }
}

export class FileReadError extends CommandDispatchError {
  constructor(
    public readonly filePath: string,
    public override readonly cause?: Error
  ) {
    super(
      `Failed to read file: ${filePath}${cause ? ` - ${cause.message}` : ""}`
    );
    this.name = "FileReadError";
    if (cause?.stack) {
      this.stack = cause.stack;
    }
  }
}

export class FileWriteError extends CommandDispatchError {
  constructor(
    public readonly filePath: string,
    public override readonly cause?: Error
  ) {
    super(
      `Failed to write file: ${filePath}${cause ? ` - ${cause.message}` : ""}`
    );
    this.name = "FileWriteError";
    if (cause?.stack) {
      this.stack = cause.stack;
    }
  }
}

export class CommandParseError extends CommandDispatchError {
  constructor(
    public readonly filePath: string,
    public readonly lineNumber?: number
  ) {
    super(
      `Failed to parse commands from file: ${filePath}${
        lineNumber ? ` at line ${lineNumber}` : ""
      }`
    );
    this.name = "CommandParseError";
  }
}

export class UploadError extends CommandDispatchError {
  constructor(
    public readonly localPath: string,
    public readonly remotePath: string,
    public readonly serverName: string,
    public override readonly cause?: Error
  ) {
    super(
      `Failed to upload ${localPath} to ${serverName}:${remotePath}${
        cause ? ` - ${cause.message}` : ""
      }`
    );
    this.name = "UploadError";
    if (cause?.stack) {
      this.stack = cause.stack;
    }
  }
}

export class InputFileNotFoundError extends CommandDispatchError {
  constructor(public readonly inputFile: string) {
    super(`Input file not found: ${inputFile}`);
    this.name = "InputFileNotFoundError";
  }
}

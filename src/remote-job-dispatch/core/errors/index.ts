export class FileIOError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly operation: "read" | "write",
    public override readonly cause?: Error
  ) {
    super(
      `Failed to ${operation} file: ${filePath}${
        cause ? ` - ${cause.message}` : ""
      }`
    );
    this.name = "FileIOError";
    if (cause?.stack) {
      this.stack = cause.stack;
    }
  }
}

export class CommandExecutionError extends Error {
  constructor(
    public readonly command: string,
    public override readonly cause?: Error
  ) {
    super(
      `Failed to execute command: ${command}${
        cause ? ` - ${cause.message}` : ""
      }`
    );
    this.name = "CommandExecutionError";
    if (cause?.stack) {
      this.stack = cause.stack;
    }
  }
}

export class StateFileBackupError extends Error {
  constructor(
    public readonly filePath: string,
    public override readonly cause?: Error
  ) {
    super(
      `Failed to backup state file: ${filePath}${
        cause ? ` - ${cause.message}` : ""
      }`
    );
    this.name = "StateFileBackupError";
    if (cause?.stack) {
      this.stack = cause.stack;
    }
  }
}

export class ServerSelectionError extends Error {
  constructor(
    public readonly filename: string,
    public readonly availableServers: string[]
  ) {
    super(`No matching server found for file: ${filename}`);
    this.name = "ServerSelectionError";
  }
}

export class ServerNotFoundError extends Error {
  constructor(public readonly serverName: string) {
    super(`Server not found: ${serverName}`);
    this.name = "ServerNotFoundError";
  }
}

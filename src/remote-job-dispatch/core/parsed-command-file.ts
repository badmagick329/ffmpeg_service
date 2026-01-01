import { ParsedCmd } from "@/command-translation";
import { Result } from "@/common/result";
import { FileIOError } from "@/remote-job-dispatch/core/errors";

export class ParsedCommandFile {
  static skipDuplicateCommandComment = "# Skipped duplicate command - ";
  static skipDuplicateOutputComment = "# Skipped duplicate output command - ";
  static commentProcessedLine = "# This line has been processed - ";

  private constructor(
    private fileContent: string,
    readonly filePath: string,
    readonly outputFilesInBatch: string[]
  ) {}

  static async create(
    filePath: string,
    outputFilesInBatch: string[]
  ): Promise<Result<ParsedCommandFile, FileIOError>> {
    const readResult = await Result.fromThrowableAsync(async () =>
      Bun.file(filePath).text()
    );

    if (readResult.isFailure) {
      return Result.failure(
        new FileIOError(filePath, "read", readResult.unwrapError())
      );
    }
    const content = readResult.unwrap();
    return Result.success(
      new ParsedCommandFile(content, filePath, outputFilesInBatch)
    );
  }

  async write(): Promise<Result<void, FileIOError>> {
    const writeResult = await Result.fromThrowableAsync(async () =>
      Bun.write(this.filePath, this.fileContent)
    );
    if (writeResult.isFailure) {
      return Result.failure(
        new FileIOError(this.filePath, "write", writeResult.unwrapError())
      );
    }
    return Result.success(undefined);
  }

  applyUniqueContent() {
    this.fileContent = this.contentAsUniqueCommands();
  }

  applyCommentAll() {
    if (this.fileContent === "") {
      return "";
    }
    this.fileContent = this.fileContent
      .split("\n")
      .filter((l) => !l.trim().startsWith("# "))
      .map((l) => {
        if (l.trim() === "") return l;
        return `${ParsedCommandFile.commentProcessedLine}${l}`;
      })
      .join("\n");
  }

  private contentAsUniqueCommands(): string {
    if (this.fileContent === "") {
      return "";
    }

    const result = [] as string[];
    const lineCounter = new Map<string, number>();
    const outputCounter = new Map<string, number>();

    const lines = this.fileContent.split("\n").map((l) => l.trim());
    const lineToOutput = new Map<string, string>();

    for (const line of lines) {
      if (line === "") {
        continue;
      }

      lineCounter.set(line, (lineCounter.get(line) ?? 0) + 1);

      try {
        const output = ParsedCmd.create(line).output;
        lineToOutput.set(line, output);

        const startAt = this.outputFilesInBatch.includes(output) ? 1 : 0;
        outputCounter.set(output, (outputCounter.get(output) ?? startAt) + 1);
      } catch {}
    }

    for (const line of lines) {
      let skipping = false;

      if (lineCounter.get(line)! > 1) {
        result.push(`${ParsedCommandFile.skipDuplicateCommandComment}${line}`);
        lineCounter.set(line, lineCounter.get(line)! - 1);
        skipping = true;
      }

      const output = lineToOutput.get(line)!;
      if (outputCounter.get(output)! > 1) {
        if (!skipping) {
          result.push(`${ParsedCommandFile.skipDuplicateOutputComment}${line}`);
        }
        outputCounter.set(output, outputCounter.get(output)! - 1);
        skipping = true;
      }

      if (!skipping) {
        result.push(line);
      }
    }

    return result.join("\n");
  }
}

import { ParsedCmd } from "@/command-translation";

export class ParsedCommandFile {
  static skipDuplicateCommandComment = "# Skipped duplicate command - ";
  static skipDuplicateOutputComment = "# Skipped duplicate output command - ";

  readonly uniqueContent: string;

  constructor(readonly fileContent: string) {
    this.uniqueContent = this.contentAsUniqueCommands();
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
        outputCounter.set(output, (outputCounter.get(output) ?? 0) + 1);
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

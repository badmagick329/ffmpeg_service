import type { ICmdConverter } from "./icmd-converter";
import type { IPathTranslator } from "./ipath-translator";

export class CmdConverter implements ICmdConverter {
  private static cmdRegex =
    /(?<start>.+?)"(?<input>.+)"(?<params>.+?)"(?<output>.+)"/;

  constructor(private readonly pathTranslater: IPathTranslator) {}

  cmdToArray(cmd: string): string[] {
    const match = cmd.match(CmdConverter.cmdRegex);
    if (!match) {
      throw new Error(
        `Invalid command format: ${cmd}. Expected format: <start> <input> <params> <output>`
      );
    }
    const { start, input, params, output } = match.groups!;
    if (!start || !input || !params || !output) {
      throw new Error(
        `Invalid command format: ${cmd}. Expected format: <start> <input> <params> <output>`
      );
    }

    const startParts = start.split(" ").filter(Boolean);
    const paramsParts = params.split(" ").filter(Boolean);
    const transformedInput = this.pathTranslater.transformFFmpegPath(
      input,
      true
    );
    const transformedOutput = this.pathTranslater.transformFFmpegPath(
      output,
      false
    );

    return [...startParts, transformedInput, ...paramsParts, transformedOutput];
  }
}

import type { ICmdTranslator } from "./icmd-translator";
import type { IPathTranslator } from "./ipath-translator";

type CmdParts = {
  start: string;
  input: string;
  params: string;
  output: string;
};

export class CmdTranslater implements ICmdTranslator {
  private static cmdRegex =
    /(?<start>.+?)"(?<input>.+)"(?<params>.+?)"(?<output>.+)"/;

  constructor(private readonly pathTranslater: IPathTranslator) {}

  localizeCmd(cmd: string): string {
    const { start, input, params, output } = this.getParts(cmd);
    const localizedInput = this.pathTranslater.localize(input, true);
    const localizedOutput = this.pathTranslater.localize(output, false);
    return `${start}"${localizedInput}"${params}"${localizedOutput}"`;
  }

  cmdToArray(cmd: string): string[] {
    const { start, input, params, output } = this.getParts(cmd);

    const startParts = start.split(" ").filter(Boolean);
    const paramsParts = params.split(" ").filter(Boolean);

    return [...startParts, input, ...paramsParts, output];
  }

  arrayToCmd(arrayCmd: string[]): string {
    if (arrayCmd.length < 4) {
      throw new Error(
        `Invalid command array: ${arrayCmd}. Expected at least 4 elements: <start> <input> <params> <output>`
      );
    }

    const parts = [arrayCmd[0]];
    for (let i = 1; i < arrayCmd.length - 1; i++) {
      if (arrayCmd[i - 1] === "-i") {
        parts.push(`"${arrayCmd[i]}"`);
      } else {
        parts.push(arrayCmd[i]);
      }
    }
    parts.push(`"${arrayCmd[arrayCmd.length - 1]}"`);
    return parts.join(" ");
  }

  private getParts(cmd: string): CmdParts {
    const match = cmd.match(CmdTranslater.cmdRegex);
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

    return {
      start,
      input,
      params,
      output,
    };
  }
}

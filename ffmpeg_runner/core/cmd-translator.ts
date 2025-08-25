import type { ICmdTranslator } from "./icmd-translator";
import type { IPathTranslator } from "./ipath-translator";
import { ParsedCmd } from "./parsed-cmd";

export class CmdTranslater implements ICmdTranslator {
  constructor(private readonly pathTranslater: IPathTranslator) {}

  localizeCmd(cmd: ParsedCmd): ParsedCmd {
    const localizedInput = this.pathTranslater.localize({
      filepath: cmd.input,
      isInput: true,
    });
    const localizedOutput = this.pathTranslater.localize({
      filepath: cmd.output,
      isInput: false,
    });
    return ParsedCmd.create(
      `${cmd.start}"${localizedInput}"${cmd.params}"${localizedOutput}"`
    );
  }

  cmdToArray(cmd: ParsedCmd): string[] {
    const startParts = cmd.start.split(" ").filter(Boolean);
    const paramsParts = cmd.params.split(" ").filter(Boolean);

    return [...startParts, cmd.input, ...paramsParts, cmd.output];
  }

  arrayToCmd(arrayCmd: string[]): ParsedCmd {
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
    return ParsedCmd.create(parts.join(" "));
  }
}

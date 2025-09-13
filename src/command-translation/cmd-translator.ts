import type { IPathTranslator } from "@/command-translation/path-translator";
import { ParsedCmd } from "@/command-translation/parsed-cmd";

export interface ICmdTranslator {
  localizeCmd(cmd: ParsedCmd): ParsedCmd;
  cmdToArray(cmd: ParsedCmd): string[];
  arrayToCmd(arrayCmd: string[]): ParsedCmd;
}

export class CmdTranslator implements ICmdTranslator {
  constructor(private readonly pathTranslator: IPathTranslator) {}

  localizeCmd(cmd: ParsedCmd): ParsedCmd {
    const localizedInput = this.pathTranslator.localize({
      filepath: cmd.input,
      isInput: true,
    });
    const localizedOutput = this.pathTranslator.localize({
      filepath: cmd.output,
      isInput: false,
    });
    const result = `${cmd.start}"${localizedInput}"${cmd.params}"${localizedOutput}"`;
    return ParsedCmd.create(result);
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

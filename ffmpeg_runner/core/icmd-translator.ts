import { ParsedCmd } from "./parsed-cmd";

export interface ICmdTranslator {
  localizeCmd(cmd: ParsedCmd): ParsedCmd;
  cmdToArray(cmd: ParsedCmd): string[];
  arrayToCmd(arrayCmd: string[]): ParsedCmd;
}

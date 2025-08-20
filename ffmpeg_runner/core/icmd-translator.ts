export interface ICmdTranslator {
  localizeCmd(cmd: string): string;
  cmdToArray(cmd: string): string[];
  arrayToCmd(arrayCmd: string[]): string;
}

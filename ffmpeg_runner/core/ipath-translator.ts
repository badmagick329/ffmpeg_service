export interface IPathTranslator {
  localize(filePath: string, isInput: boolean): string;
}

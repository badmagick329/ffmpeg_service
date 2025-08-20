export interface IPathTranslator {
  localize(filepath: string, isInput: boolean): string;
}

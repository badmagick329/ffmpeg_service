export interface IPathTranslator {
  localize(params: { filepath: string; isInput: boolean }): string;
}

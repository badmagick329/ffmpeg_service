export interface IPathTranslator {
  transformFFmpegPath(filePath: string, isInput: boolean): string;
}

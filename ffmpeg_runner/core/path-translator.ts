import type { IPathTranslator } from "./ipath-translator";

export class PathTranslator implements IPathTranslator {
  private readonly src: string;
  private readonly dst: string;

  /**
   * @param src - The source directory, e.g. "./"
   * @param dst - The destination directory, e.g. "../outputs/"
   * */
  constructor({ src, dst }: { src: string; dst: string }) {
    this.src = src;
    this.dst = dst;
  }

  localize(filePath: string, isInput: boolean = true): string {
    if (filePath.includes("\\")) {
      if (filePath.includes("/")) {
        throw new Error(
          `Invalid filepath: ${filePath}. Cannot contain both '\\' and '/'`
        );
      }

      const match = filePath.match(/.+\\(?<filename>.+)/);
      if (!match) {
        throw new Error(
          `Invalid filepath: ${filePath}. Must end with '\\filename'`
        );
      }
      const filename = match.groups!.filename!;
      return `${isInput ? this.src : this.dst}/${filename}`;
    }
    if (filePath.includes("/")) {
      return filePath;
    }

    throw new Error(`Invalid filepath: ${filePath}. Must contain '/' or '\\'`);
  }
}

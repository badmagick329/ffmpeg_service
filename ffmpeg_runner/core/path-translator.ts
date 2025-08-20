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

  localize(filepath: string, isInput: boolean = true): string {
    if (filepath.includes("\\")) {
      if (filepath.includes("/")) {
        throw new Error(
          `Invalid filepath: ${filepath}. Cannot contain both '\\' and '/'`
        );
      }

      const match = filepath.match(/.+\\(?<filename>.+)/);
      if (!match) {
        throw new Error(
          `Invalid filepath: ${filepath}. Must end with '\\filename'`
        );
      }
      const filename = match.groups!.filename!;
      return `${isInput ? this.src : this.dst}/${filename}`;
    }
    if (filepath.includes("/")) {
      return filepath;
    }

    throw new Error(`Invalid filepath: ${filepath}. Must contain '/' or '\\'`);
  }
}

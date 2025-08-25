import type { IPathTranslator } from "./ipath-translator";
import * as path from "node:path";

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

  localize({
    filepath,
    isInput = true,
  }: {
    filepath: string;
    isInput: boolean;
  }): string {
    if (filepath.includes("\\") && filepath.includes("/")) {
      throw new Error(
        `Invalid filepath: ${filepath}. Cannot contain both '\\' and '/'`
      );
    }

    // Escaping for regex
    const splitter = filepath.includes("\\") ? "\\\\" : "/";
    const re = RegExp(`.+${splitter}(?<filename>.+)`);
    const match = filepath.match(re);
    if (!match) {
      throw new Error(
        `Invalid filepath: ${filepath}. Must end with '${splitter}filename'`
      );
    }
    const filename = match.groups!.filename!;
    const prefex = `${isInput ? this.src : this.dst}`;
    return path.join(prefex, filename);
  }
}

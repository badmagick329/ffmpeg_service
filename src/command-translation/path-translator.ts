import * as path from "node:path";

export interface IPathTranslator {
  localize(params: { filepath: string; isInput: boolean }): string;
}

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

    const osSplitter = process.platform === "win32" ? "\\" : "/";
    // Escaping for regex
    const filepathSplitter = filepath.includes("\\") ? "\\\\" : "/";
    const re = RegExp(`.+${filepathSplitter}(?<filename>.+)`);
    const match = filepath.match(re);
    if (!match) {
      throw new Error(
        `Invalid filepath: ${filepath}. Must end with '${osSplitter}filename'`
      );
    }
    const filename = match.groups!.filename!;

    // path.join breaks relative paths. fix:
    const origin = isInput ? this.src : this.dst;
    let localized = path.join(origin, filename);
    if (/\.[\\/]+/.test(origin) && !localized.startsWith(`.${osSplitter}`)) {
      localized = `.${osSplitter}${localized}`;
    }
    return localized;
  }
}

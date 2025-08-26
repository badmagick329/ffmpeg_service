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
    let localized = path.join(prefex, filename);

    // If the original filepath started with a dot + separator ("./" or ".\\"),
    // only reapply the leading dot when the remainder of the filepath actually
    // corresponds to the configured prefix (e.g. './data/incoming/...').
    // This avoids adding './' for unrelated inputs like './foo/bar'.
    if (/^\.([\\/])/.test(filepath)) {
      // strip leading './' or '.\\' from both strings and normalize separators
      const stripLeadingDot = (s: string) => s.replace(/^\.([\\/])/, "");
      const normalizeSep = (s: string) => s.replace(/[\\/]+/g, path.sep);

      const filepathNoDot = normalizeSep(stripLeadingDot(filepath));
      const prefexNoDot = normalizeSep(stripLeadingDot(prefex));

      if (filepathNoDot.startsWith(prefexNoDot)) {
        const dotPrefix = "." + path.sep;
        if (!localized.startsWith(dotPrefix)) {
          localized = dotPrefix + localized;
        }
      }
    }

    return localized;
  }
}

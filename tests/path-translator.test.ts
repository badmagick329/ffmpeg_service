import { describe, it, expect } from "bun:test";
import { PathTranslator } from "@/core/translators/path-translator";
import * as path from "node:path";

// Mock src and dst directories
const src = "data/incoming";
const dst = "data/outgoing";
const translator = new PathTranslator({ src, dst });

describe("PathTranslator.localize", () => {
  it("should localize input file with forward slashes", () => {
    const result = translator.localize({
      filepath: "foo/bar/baz.mp4",
      isInput: true,
    });
    expect(result).toBe(path.join(src, "baz.mp4"));
  });

  it("should localize input file with backslashes", () => {
    const result = translator.localize({
      filepath: "foo\\bar\\baz.mp4",
      isInput: true,
    });
    expect(result).toBe(path.join(src, "baz.mp4"));
  });

  it("should localize output file with forward slashes", () => {
    const result = translator.localize({
      filepath: "foo/bar/baz.mp4",
      isInput: false,
    });
    expect(result).toBe(path.join(dst, "baz.mp4"));
  });

  it("should localize output file with backslashes", () => {
    const result = translator.localize({
      filepath: "foo\\bar\\baz.mp4",
      isInput: false,
    });
    expect(result).toBe(path.join(dst, "baz.mp4"));
  });

  it("should throw if filepath contains both slashes and backslashes", () => {
    expect(() =>
      translator.localize({ filepath: "foo/bar\\baz.mp4", isInput: true })
    ).toThrow();
  });

  it("should throw if filepath does not match expected pattern", () => {
    expect(() =>
      translator.localize({ filepath: "baz", isInput: true })
    ).toThrow();
  });
});

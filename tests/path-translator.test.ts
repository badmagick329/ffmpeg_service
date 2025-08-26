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

describe("PathTranslator.localize - edge cases (relative/absolute, unicode, dots)", () => {
  const translatorRelative = new PathTranslator({
    src: "./data/incoming",
    dst: "./data/outgoing",
  });
  const translatorAbsolute = new PathTranslator({
    src: path.resolve("data/incoming"),
    dst: path.resolve("data/outgoing"),
  });

  it("should handle relative paths with leading './' and '../'", () => {
    expect(
      translatorRelative.localize({
        filepath: "./foo/bar/baz.mp4",
        isInput: true,
      })
    ).toBe(path.join("./data/incoming", "baz.mp4"));

    expect(
      translatorRelative.localize({
        filepath: "../foo/bar/qux.mp4",
        isInput: true,
      })
    ).toBe(path.join("./data/incoming", "qux.mp4"));
  });

  it("should preserve leading './' or '.\\' when src includes it (Windows sampleInput)", () => {
    const srcRel = "./data/incoming";
    const filepath = ".\\data\\incoming\\120614 input.mkv";
    const result = translatorRelative.localize({ filepath, isInput: true });
    const expected =
      srcRel.replace(/\//g, path.sep) + path.sep + "120614 input.mkv";
    expect(result).toBe(expected);
  });

  it("explicitly: sampleInput from config.toml should keep leading dot separator", () => {
    // sampleInput in config.toml is: '.\\data\\incoming\\120614 input.mkv'
    const sampleInput = ".\\data\\incoming\\120614 input.mkv";
    const res = translatorRelative.localize({
      filepath: sampleInput,
      isInput: true,
    });
    // Expect the result to start with './' or '.\\' depending on platform
    expect(res.startsWith("." + path.sep)).toBe(true);
  });

  it("should handle absolute POSIX and Windows-style paths", () => {
    // POSIX-style absolute
    expect(
      translatorRelative.localize({
        filepath: "/var/media/movie.mp4",
        isInput: true,
      })
    ).toBe(path.join("./data/incoming", "movie.mp4"));

    // Windows-style absolute
    expect(
      translatorRelative.localize({
        filepath: "C:\\Temp\\clip.mp4",
        isInput: true,
      })
    ).toBe(path.join("./data/incoming", "clip.mp4"));

    // When src is absolute, output should preserve absolute prefix
    expect(
      translatorAbsolute.localize({
        filepath: "/var/media/movie.mp4",
        isInput: true,
      })
    ).toBe(path.join(path.resolve("data/incoming"), "movie.mp4"));
  });

  it("should handle filenames with multiple dots and unicode characters", () => {
    expect(
      translatorRelative.localize({
        filepath: "dir/sub.name/video.v1.final.mp4",
        isInput: true,
      })
    ).toBe(path.join("./data/incoming", "video.v1.final.mp4"));

    expect(
      translatorRelative.localize({ filepath: "目录/视频.mp4", isInput: true })
    ).toBe(path.join("./data/incoming", "视频.mp4"));
  });
});

import { describe, it, expect } from "bun:test";
import { ParsedCmd } from "@/command-translation";

describe("ParsedCmd.create", () => {
  it("should parse a valid ffmpeg command", () => {
    const cmd =
      'ffmpeg -y -i "./input.mkv" -c:v libx264 -crf 24 -preset slow -c:a copy -vf bwdif=mode=1:parity=auto:deint=1 -ss 00:00:05.380 -to 00:00:13.054 "./output.mkv"';
    const parsed = ParsedCmd.create(cmd);
    expect(parsed.start).toBe("ffmpeg -y -i ");
    expect(parsed.input).toBe("./input.mkv");
    expect(parsed.params).toBe(
      " -c:v libx264 -crf 24 -preset slow -c:a copy -vf bwdif=mode=1:parity=auto:deint=1 -ss 00:00:05.380 -to 00:00:13.054 "
    );
    expect(parsed.output).toBe("./output.mkv");
  });
  it("should parse an ffmpeg command when params include quotes", () => {
    const cmd =
      'ffmpeg -y -i "./input.mkv" -metadata title="My Video" -c:v libx264 "./output.mkv"';
    const parsed = ParsedCmd.create(cmd);
    expect(parsed.start).toBe("ffmpeg -y -i ");
    expect(parsed.input).toBe("./input.mkv");
    expect(parsed.params).toBe(' -metadata title="My Video" -c:v libx264 ');
    expect(parsed.output).toBe("./output.mkv");
  });
});

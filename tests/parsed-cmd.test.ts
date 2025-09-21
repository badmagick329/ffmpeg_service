import { describe, it, expect } from "bun:test";
import { ParsedCmd } from "@/command-translation";

describe("ParsedCmd.create", () => {
  it("should parse a valid ffmpeg command with relative paths", () => {
    const cmd =
      'ffmpeg -y -i "./input.mkv" -c:v libx264 -crf 24 -preset slow -c:a copy -vf bwdif=mode=1:parity=auto:deint=1 -ss 00:00:05.380 -to 00:00:13.054 "./output.mkv"';
    const parsed = ParsedCmd.create(cmd);
    expect(parsed.start).toBe("ffmpeg -y -hide_banner -nostdin -i ");
    expect(parsed.input).toBe("./input.mkv");
    expect(parsed.params).toBe(
      " -c:v libx264 -crf 24 -preset slow -c:a copy -vf bwdif=mode=1:parity=auto:deint=1 -ss 00:00:05.380 -to 00:00:13.054 "
    );
    expect(parsed.output).toBe("./output.mkv");
  });
  it("should parse a valid ffmpeg command with absolute paths", () => {
    const cmd =
      'ffmpeg -y -i "/home/user/videos/input.mkv" -c:v libx264 -crf 24 -preset slow -c:a copy -vf bwdif=mode=1:parity=auto:deint=1 -ss 00:00:05.380 -to 00:00:13.054 "/home/user/videos/output.mkv"';
    const parsed = ParsedCmd.create(cmd);
    expect(parsed.start).toBe("ffmpeg -y -hide_banner -nostdin -i ");
    expect(parsed.input).toBe("/home/user/videos/input.mkv");
    expect(parsed.params).toBe(
      " -c:v libx264 -crf 24 -preset slow -c:a copy -vf bwdif=mode=1:parity=auto:deint=1 -ss 00:00:05.380 -to 00:00:13.054 "
    );
    expect(parsed.output).toBe("/home/user/videos/output.mkv");
  });

  it("should change multispace seperators to single space in start", () => {
    const cmd =
      'ffmpeg -y    -i   "./input.mkv" -c:v libx264 -crf 24 -preset slow -c:a copy -vf bwdif=mode=1:parity=auto:deint=1 -ss 00:00:05.380 -to 00:00:13.054 "./output.mkv"';
    const parsed = ParsedCmd.create(cmd);
    expect(parsed.start).toBe("ffmpeg -y -hide_banner -nostdin -i ");
    expect(parsed.input).toBe("./input.mkv");
    expect(parsed.params).toBe(
      " -c:v libx264 -crf 24 -preset slow -c:a copy -vf bwdif=mode=1:parity=auto:deint=1 -ss 00:00:05.380 -to 00:00:13.054 "
    );
    expect(parsed.output).toBe("./output.mkv");
  });

  it("should parse a command with several start parts", () => {
    const cmd =
      'ffmpeg -ss 3445.058 -probesize 100M -analyzeduration 100M -y -i "/home/usr/input.mp4" -c:v libsvtav1 -crf 39 -preset 4 -c:a copy -vf bwdif=mode=1:parity=auto:deint=1  -t 209.493 "/home/usr/output.mp4"';
    const parsed = ParsedCmd.create(cmd);
    expect(parsed.start).toBe(
      "ffmpeg -ss 3445.058 -probesize 100M -analyzeduration 100M -y -hide_banner -nostdin -i "
    );
    expect(parsed.input).toBe("/home/usr/input.mp4");
    expect(parsed.params).toBe(
      " -c:v libsvtav1 -crf 39 -preset 4 -c:a copy -vf bwdif=mode=1:parity=auto:deint=1  -t 209.493 "
    );
    expect(parsed.output).toBe("/home/usr/output.mp4");
  });

  it("should parse a command with < 3 args at the start", () => {
    const cmd =
      'ffmpeg -i "./input.mkv" -c:v libx264 -crf 24 -preset slow -c:a copy -vf bwdif=mode=1:parity=auto:deint=1 -ss 00:00:05.380 -to 00:00:13.054 "./output.mkv"';
    const parsed = ParsedCmd.create(cmd);
    expect(parsed.start).toBe("ffmpeg -y -hide_banner -nostdin -i ");
    expect(parsed.input).toBe("./input.mkv");
    expect(parsed.params).toBe(
      " -c:v libx264 -crf 24 -preset slow -c:a copy -vf bwdif=mode=1:parity=auto:deint=1 -ss 00:00:05.380 -to 00:00:13.054 "
    );
    expect(parsed.output).toBe("./output.mkv");
  });

  it("should parse an ffmpeg command when params include quotes", () => {
    const cmd =
      'ffmpeg -y -hide_banner -nostdin -i "./input.mkv" -metadata title="My Video" -c:v libx264 "./output.mkv"';
    const parsed = ParsedCmd.create(cmd);
    expect(parsed.start).toBe("ffmpeg -y -hide_banner -nostdin -i ");
    expect(parsed.input).toBe("./input.mkv");
    expect(parsed.params).toBe(' -metadata title="My Video" -c:v libx264 ');
    expect(parsed.output).toBe("./output.mkv");
  });
});

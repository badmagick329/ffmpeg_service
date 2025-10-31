import { describe, it, expect } from "bun:test";
import { ParsedCommandFile } from "@/remote-job-dispatch/core/parsed-command-file";
import { ExceptionHandler, exceptions } from "winston";

describe("ParsedCommandFile.contentAsUniqueCommands", () => {
  it("should keep last occurrence when exact duplicate lines exist", () => {
    const duplicateCommand = 'ffmpeg -i "input.mp4" -c:v libx264 "output.mp4"';
    const fileContent = `${duplicateCommand}\n${duplicateCommand}\n${duplicateCommand}`;

    const result = new ParsedCommandFile(fileContent);

    const lines = result.uniqueContent.split("\n");
    expect(lines[0]).toContain(ParsedCommandFile.skipDuplicateCommandComment);
    expect(lines[0]).toContain(duplicateCommand);
    expect(lines[1]).toContain(ParsedCommandFile.skipDuplicateCommandComment);
    expect(lines[1]).toContain(duplicateCommand);
    expect(lines[2]).toBe(duplicateCommand);
  });

  it("should keep last occurrence when commands have duplicate output files", () => {
    const sameOutputFile = "output.mp4";
    const firstCommand = `ffmpeg -i "input1.mp4" -c:v libx264 "${sameOutputFile}"`;
    const secondCommand = `ffmpeg -i "input2.mp4" -c:v libx265 "${sameOutputFile}"`;
    const thirdCommand = `ffmpeg -i "input3.mp4" -crf 23 "${sameOutputFile}"`;
    const fileContent = `${firstCommand}\n${secondCommand}\n${thirdCommand}`;

    const result = new ParsedCommandFile(fileContent);

    const lines = result.uniqueContent.split("\n");
    expect(lines[0]).toContain(ParsedCommandFile.skipDuplicateOutputComment);
    expect(lines[0]).toContain(firstCommand);
    expect(lines[1]).toContain(ParsedCommandFile.skipDuplicateOutputComment);
    expect(lines[1]).toContain(secondCommand);
    expect(lines[2]).toBe(thirdCommand);
  });

  it("should handle mix of unique and duplicate commands correctly", () => {
    const uniqueCommand1 = 'ffmpeg -i "input1.mp4" "output1.mp4"';
    const duplicateCommand = 'ffmpeg -i "input2.mp4" "output2.mp4"';
    const uniqueCommand2 = 'ffmpeg -i "input3.mp4" "output3.mp4"';
    const fileContent = `${uniqueCommand1}\n${duplicateCommand}\n${uniqueCommand2}\n${duplicateCommand}`;

    const result = new ParsedCommandFile(fileContent);

    const lines = result.uniqueContent.split("\n");
    expect(lines[0]).toBe(uniqueCommand1);
    expect(lines[1]).toContain(ParsedCommandFile.skipDuplicateCommandComment);
    expect(lines[2]).toBe(uniqueCommand2);
    expect(lines[3]).toBe(duplicateCommand);
  });

  it("should comment out only once when line is both exact duplicate and output duplicate", () => {
    const command = 'ffmpeg -i "input.mp4" "output.mp4"';
    const fileContent = `${command}\n${command}`;

    const result = new ParsedCommandFile(fileContent);

    const lines = result.uniqueContent.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain(ParsedCommandFile.skipDuplicateCommandComment);
    expect(lines[0]).toContain(command);
    expect(lines[1]).toBe(command);
  });

  it("should pass through unparseable lines without deduplication", () => {
    const invalidCommand1 = "not a valid ffmpeg command";
    const invalidCommand2 = "also not valid";
    const validCommand = 'ffmpeg -i "input.mp4" "output.mp4"';
    const fileContent = `${invalidCommand1}\n${invalidCommand2}\n${validCommand}\n${invalidCommand1}`;

    const result = new ParsedCommandFile(fileContent);

    const lines = result.uniqueContent.split("\n");
    expect(lines[0]).toContain(ParsedCommandFile.skipDuplicateCommandComment);
    expect(lines[0]).toContain(invalidCommand1);
    expect(lines[1]).toBe(invalidCommand2);
    expect(lines[2]).toBe(validCommand);
    expect(lines[3]).toBe(invalidCommand1);
  });

  it("should handle empty file content", () => {
    const result = new ParsedCommandFile("");

    expect(result.uniqueContent).toBe("");
  });

  it("should handle realistic batch scenario with multiple duplicate types", () => {
    const uniqueCmd = 'ffmpeg -i "video1.mp4" "output1.mp4"';
    const duplicateExactCmd = 'ffmpeg -i "video2.mp4" -crf 23 "output2.mp4"';
    const duplicateOutputCmd1 = 'ffmpeg -i "video3.mp4" -crf 20 "shared.mp4"';
    const duplicateOutputCmd2 = 'ffmpeg -i "video4.mp4" -crf 25 "shared.mp4"';
    const fileContent = [
      uniqueCmd,
      duplicateExactCmd,
      duplicateExactCmd,
      duplicateOutputCmd1,
      uniqueCmd,
      duplicateOutputCmd2,
    ].join("\n");

    const result = new ParsedCommandFile(fileContent);

    const lines = result.uniqueContent.split("\n");
    expect(lines[0]).toContain(ParsedCommandFile.skipDuplicateCommandComment);
    expect(lines[0]).toContain(uniqueCmd);
    expect(lines[1]).toContain(ParsedCommandFile.skipDuplicateCommandComment);
    expect(lines[1]).toContain(duplicateExactCmd);
    expect(lines[2]).toBe(duplicateExactCmd);
    expect(lines[3]).toContain(ParsedCommandFile.skipDuplicateOutputComment);
    expect(lines[3]).toContain(duplicateOutputCmd1);
    expect(lines[4]).toBe(uniqueCmd);
    expect(lines[5]).toBe(duplicateOutputCmd2);
  });

  it("should leave empty lines as they are and not flag them as duplicate", () => {
    const fileContent = ["", "", "ffmpeg -i input.mp4 output.mp4", ""].join(
      "\n"
    );

    const result = new ParsedCommandFile(fileContent);
    const lines = result.uniqueContent.split("\n");
    expect(lines.length).toBe(4);
    expect(lines[2]).toBe("ffmpeg -i input.mp4 output.mp4");
    [lines[0], lines[1], lines[3]].forEach((l) => expect(l).toBe(""));
  });
  it("should comment out outputs present in the outputFilesInBatch list", () => {
    const line0 = 'ffmpeg -i "input.mp4" -c:v libx264 -crf 20 "output0.mp4"';
    const line1 =
      'ffmpeg -i "D:/media/input.mp4" -c:v libx264 -crf 20 "output1.mp4"';
    const line2 =
      'ffmpeg -i "/usr/local/videos/input.mp4" -c:v libx264 -crf 20 "output2.mp4"';
    const line3 =
      'ffmpeg -i "data/input.mp4" -c:v libx264 -crf 20 "output3.mp4"';
    const fileContent = [line0, line1, line2, line3].join("\n");

    const result = new ParsedCommandFile(fileContent, [
      "output1.mp4",
      "output2.mp4",
    ]);
    const lines = result.uniqueContent.split("\n");
    expect(lines.length).toBe(4);
    expect(lines[0]).toBe(line0);
    expect(lines[1]).toBe(
      `${ParsedCommandFile.skipDuplicateOutputComment}${line1}`
    );
    expect(lines[2]).toBe(
      `${ParsedCommandFile.skipDuplicateOutputComment}${line2}`
    );
    expect(lines[3]).toBe(line3);
  });
});

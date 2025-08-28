import { ParsedCmd } from "@/core/models/parsed-cmd";
import type { ICmdTranslator } from "@/core/translators/cmd-translator";
import * as path from "node:path";

export const JOB_STATUS = {
  MISSING_INPUT: "missing_input",
  PENDING: "pending",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
} as const;
export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export class Job {
  private constructor(
    readonly rawCmd: string,
    readonly localizedCmd: string,
    readonly inputFile: string,
    public status: JobStatus
  ) {}

  /**
   * Creates a Job instance from the given ffmpeg command.
   *
   * @param ffmpegCmd - The ffmpeg command to create the job from.
   * @param cmdTranslator - The command translator to localize paths.
   * @throws {Error} If the ffmpeg command is invalid.
   */
  static fromCmd(ffmpegCmd: string, cmdTranslator: ICmdTranslator): Job {
    const cmd = ParsedCmd.create(ffmpegCmd);
    const localizedCmd = cmdTranslator.localizeCmd(cmd);
    const filename = path.basename(localizedCmd.input);
    return new Job(cmd.cmd, localizedCmd.cmd, filename, "missing_input");
  }
}

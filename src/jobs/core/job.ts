import { ParsedCmd } from "@/command-translation/parsed-cmd";
import type { ICmdTranslator } from "@/command-translation/cmd-translator";
import type { JobStatus } from "@/jobs/core/job-status";
import { JOB_STATUS } from "@/jobs/core/job-status";
import * as path from "node:path";

export type NewJob = Omit<Job, "status">;

export class Job {
  private constructor(
    readonly rawCmd: string,
    readonly localizedCmd: string,
    readonly inputFile: string,
    public status: JobStatus
  ) {}

  /**
   * Creates a Job instance minus the status from the given ffmpeg command.
   *
   * @param ffmpegCmd - The ffmpeg command to create the job from.
   * @param cmdTranslator - The command translator to localize paths.
   * @throws {Error} If the ffmpeg command is invalid.
   */
  static fromCmd(ffmpegCmd: string, cmdTranslator: ICmdTranslator): NewJob {
    const cmd = ParsedCmd.create(ffmpegCmd);
    const localizedCmd = cmdTranslator.localizeCmd(cmd);
    const filename = path.basename(localizedCmd.input);
    return new Job(cmd.cmd, localizedCmd.cmd, filename, JOB_STATUS.PENDING);
  }
}

import type { ICmdTranslator } from "../core/icmd-translator";
import type { IInputFilesRepository } from "../core/iinput-files-repository";
import type { IJobsRepository } from "../core/ijobs-repository";
import { ParsedCmd } from "../core/parsed-cmd";
import type { Job } from "../core/job";

export class JobCreationService {
  constructor(
    private readonly cmdTranslator: ICmdTranslator,
    private readonly inputRepo: IInputFilesRepository,
    private readonly jobsRepo: IJobsRepository
  ) {}

  /**
   * Enqueues a job for processing.
   * @param ffmpegCmd - The ffmpeg command to execute.
   * @throws {Error} If the ffmpeg command is invalid.
   */
  enqueue(ffmpegCmd: string) {
    const job = this.createJob(ffmpegCmd);
    this.jobsRepo.enqueue(job);
  }

  /**
   * Creates a job from the provided ffmpeg command.
   * @param ffmpegCmd - The ffmpeg command to execute.
   * @throws {Error} If the ffmpeg command is invalid.
   */
  private createJob(ffmpegCmd: string): Job {
    const parsedCmd = ParsedCmd.create(ffmpegCmd);
    const localizedCmd = this.cmdTranslator.localizeCmd(parsedCmd);

    const exists = this.inputRepo.exists(localizedCmd.input);
    return {
      rawCmd: parsedCmd.cmd,
      localizedCmd: localizedCmd.cmd,
      inputFile: localizedCmd.input,
      status: exists ? "pending" : "missing_input",
    } as Job;
  }
}

import type { ICmdTranslator } from "@/core/translators/cmd-translator";
import type { IInputFilesRepository } from "@/core/repositories/iinput-files-repository";
import type { IJobsRepository } from "@/core/repositories/ijobs-repository";
import { ParsedCmd } from "@/core/models/parsed-cmd";
import { Job } from "@/core/models/job";

export class JobCreationService {
  constructor(
    private readonly cmdTranslator: ICmdTranslator,
    private readonly inputRepo: IInputFilesRepository,
    private readonly jobsRepo: IJobsRepository
  ) {}

  /**
   * Enqueues a unique job for processing. If a job with the same localized command
   * already exists, it will not be added again.
   *
   * @param ffmpegCmd - The ffmpeg command to execute.
   * @returns The ID of the enqueued job, or null if the job with the same localized command already exists.
   * @throws {Error} If the ffmpeg command is invalid.
   */
  enqueueUnique(ffmpegCmd: string) {
    const job = this.createJob(ffmpegCmd);
    return this.jobsRepo.enqueueUnique(job);
  }

  /**
   * Enqueues a job for processing.
   * @param ffmpegCmd - The ffmpeg command to execute.
   * @returns The ID of the enqueued job, or null if the job is an exact duplicate.
   * @throws {Error} If the ffmpeg command is invalid.
   */
  enqueue(ffmpegCmd: string) {
    const job = this.createJob(ffmpegCmd);
    return this.jobsRepo.enqueue(job);
  }

  /**
   * Creates a job from the provided ffmpeg command.
   * @param ffmpegCmd - The ffmpeg command to execute.
   * @throws {Error} If the ffmpeg command is invalid.
   */
  private createJob(ffmpegCmd: string): Job {
    console.log(
      `[JobCreationService] - Creating job for command: ${ffmpegCmd}`
    );
    const job = Job.fromCmd(ffmpegCmd, this.cmdTranslator);

    console.log(`[JobCreationService] - Checking if ${job.inputFile} exists`);
    const exists = this.inputRepo.exists(job.inputFile);
    if (exists) {
      job.status = "pending";
    }
    return job;
  }
}

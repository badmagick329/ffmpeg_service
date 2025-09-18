import type { ICmdTranslator } from "@/command-translation/cmd-translator";
import type { IJobsRepository } from "@/jobs/core/ijobs-repository";
import { Job } from "@/jobs/core/job";

export class JobCreationService {
  constructor(
    private readonly cmdTranslator: ICmdTranslator,
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
    return Job.fromCmd(ffmpegCmd, this.cmdTranslator);
  }
}

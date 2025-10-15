import type { ICmdTranslator } from "@/command-translation/cmd-translator";
import type { LoggerPort } from "@/common/logger-port";
import type { IJobsRepository } from "@/jobs/core/ijobs-repository";
import { Job } from "@/jobs/core/job";

export class JobCreationService {
  private readonly log: LoggerPort;
  constructor(
    private readonly cmdTranslator: ICmdTranslator,
    private readonly jobsRepo: IJobsRepository,
    logger: LoggerPort
  ) {
    this.log = logger.withContext({ service: "JobCreationService" });
  }

  /**
   * Enqueues a unique job for processing. If a job with the same localized command
   * already exists, it will not be added again.
   *
   * @param ffmpegCmd - The ffmpeg command to execute.
   * @returns The ID of the enqueued job, or null if the job with the same localized command already exists or the commmand is invalid.
   * @throws {Error} If the ffmpeg command is invalid.
   */
  enqueueUnique(ffmpegCmd: string) {
    let job: Job;
    try {
      job = this.createJob(ffmpegCmd);
    } catch (error) {
      this.log.error("Failed to create job:", { error });
      return null;
    }
    const result = this.jobsRepo.enqueueUnique(job);
    if (result) {
      this.log.info("Enqueued unique job with ID:", { jobId: result.id });
    } else {
      this.log.warn(
        "Job with the same localized command already exists. Skipping enqueue."
      );
    }
    return result;
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
    this.log.info("Attempting to create job for command:", { ffmpegCmd });
    return Job.fromCmd(ffmpegCmd, this.cmdTranslator);
  }
}

import type { Job } from "@/jobs/core/job";
import type { JobStatus } from "@/jobs/core/job-status";

export interface IJobsRepository {
  /**
   * Claims a job for processing by a worker.
   *
   * @param wid - The worker ID claiming the job.
   * @param leaseUntil - Optional timestamp until which the job is leased to the worker. Defaults to 3 hours from now.
   * @returns The claimed job's ID and localized command, or null if no job is available.
   */
  claim(wid: number): { id: number; localizedCmd: string } | null;
  setSuccess(jobId: number): void;
  setFail(jobId: number): void;
  setRunning(jobId: number): void;
  enqueueUnique(job: Job): { id: number } | null;
  enqueue(job: Job): { id: number } | null;
  updateStatus(inputFile: string, status: JobStatus): void;
}

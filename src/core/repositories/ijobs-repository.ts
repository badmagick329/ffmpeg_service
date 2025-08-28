import type { Job, JobStatus } from "@/core/models/job";

export interface IJobsRepository {
  /**
   * Claims a job for processing by a worker.
   *
   * @param wid - The worker ID claiming the job.
   * @param leaseUntil - Optional timestamp until which the job is leased to the worker. Defaults to 3 hours from now.
   * @returns The claimed job's ID and localized command, or null if no job is available.
   */
  claim(wid: number): { id: number; localizedCmd: string } | null;
  enqueueUnique(job: Job): { id: number } | null;
  enqueue(job: Job): { id: number } | null;
  updateStatus(inputFile: string, status: JobStatus): void;
  changeStatusFrom(
    localizedCmd: string,
    oldStatus: JobStatus,
    newStatus: JobStatus
  ): void;
}

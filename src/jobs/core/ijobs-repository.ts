import type { NewJob } from "@/jobs";
import type { StatusCount } from "@/tui/lib/app-state";

export interface IJobsRepository {
  /**
   * Claims a job for processing by a worker.
   *
   * @param wid - The worker ID claiming the job.
   * @param leaseUntil - Optional timestamp until which the job is leased to the worker. Defaults to 3 hours from now.
   * @returns The claimed job's ID and localized command, or null if no job is available.
   */
  claim(): { id: number; localizedCmd: string } | null;
  setSuccess(jobId: number): void;
  setFail(jobId: number): void;
  enqueueUnique(job: NewJob): { id: number } | null;
  enqueue(job: NewJob): { id: number } | null;

  getJobStatusCount(): StatusCount;
}

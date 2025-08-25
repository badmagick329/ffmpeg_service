import type { Job } from "./job";
import type { JobStatus } from "./job";

export interface IJobsRepository {
  enqueueUnique(job: Job): { id: number } | null;
  enqueue(job: Job): { id: number } | null;
  updateStatus(inputFile: string, status: JobStatus): void;
  changeStatusFrom(
    inputFile: string,
    oldStatus: JobStatus,
    newStatus: JobStatus
  ): void;
}

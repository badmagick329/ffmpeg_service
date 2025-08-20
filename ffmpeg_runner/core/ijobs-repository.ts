import type { Job } from "./job";
import type { JobStatus } from "./job";

export interface IJobsRepository {
  enqueue(job: Job): { id: number } | null;
  updateStatus(inputFile: string, status: JobStatus): void;
  updateStatusFrom(
    inputFile: string,
    oldStatus: JobStatus,
    newStatus: JobStatus
  ): void;
}

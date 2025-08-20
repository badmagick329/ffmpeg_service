import type { Job } from "./job";

export interface IJobsRepository {
  enqueue(job: Job): { id: number } | null;
}

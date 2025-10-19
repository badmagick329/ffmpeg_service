import type { IJobsRepository } from "@/jobs/core/ijobs-repository";

export class JobLifecycleService {
  constructor(private readonly jobsRepo: IJobsRepository) {}

  claim() {
    return this.jobsRepo.claim();
  }

  setSuccess(jobId: number) {
    this.jobsRepo.setSuccess(jobId);
  }

  setFail(jobId: number) {
    this.jobsRepo.setFail(jobId);
  }
}

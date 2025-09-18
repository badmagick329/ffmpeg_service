import type { IJobsRepository } from "@/jobs/core/ijobs-repository";

export class JobProcessingService {
  constructor(private readonly jobsRepo: IJobsRepository) {}

  claim() {
    // TODO: Remove this ID requirement. we're not going with multiple workers anytime soon
    return this.jobsRepo.claim(1);
  }

  setSuccess(jobId: number) {
    this.jobsRepo.setSuccess(jobId);
  }

  setFail(jobId: number) {
    this.jobsRepo.setFail(jobId);
  }

  setRunning(jobId: number) {
    this.jobsRepo.setRunning(jobId);
  }
}

import type { IJobsRepository } from "@/jobs/core/ijobs-repository";
import type { Job } from "@/jobs/core/job";
import type { JobStatus } from "@/jobs/core/job-status";
import { jobsManager } from "@/infra/db";
import type { LoggerPort } from "@/common/logger-port";

export class JobsRepository implements IJobsRepository {
  private readonly _enqueue: typeof jobsManager.enqueue;
  private readonly _updateStatus: typeof jobsManager.updateStatus;
  private readonly _setSuccess: typeof jobsManager.setSuccess;
  private readonly _setFail: typeof jobsManager.setFail;
  private readonly _setRunning: typeof jobsManager.setRunning;
  private readonly _getJobIdWithLocalizedCmd: typeof jobsManager.getJobIdWithLocalizedCmd;
  private readonly _claim: typeof jobsManager.claim;

  private readonly log: LoggerPort;

  constructor(logger: LoggerPort) {
    this._enqueue = jobsManager.enqueue;
    this._updateStatus = jobsManager.updateStatus;
    this._setSuccess = jobsManager.setSuccess;
    this._setFail = jobsManager.setFail;
    this._setRunning = jobsManager.setRunning;
    this._getJobIdWithLocalizedCmd = jobsManager.getJobIdWithLocalizedCmd;
    this._claim = jobsManager.claim;

    this.log = logger.withContext({ service: "JobsRepository" });
  }
  setSuccess(jobId: number) {
    this._setSuccess.run({ $id: jobId });
  }
  setFail(jobId: number): void {
    this._setFail.run({ $id: jobId });
  }
  setRunning(jobId: number): void {
    this._setRunning.run({ $id: jobId });
  }

  claim(): { id: number; localizedCmd: string } | null {
    const now = Date.now();
    this.log.info("Attempting to claim a job");
    const leaseUntil = now + 1000 * 60 * 60 * 3;
    const claimed = this._claim.get({
      // NOTE: only one worker per app for now
      $wid: 1,
      $lease: leaseUntil,
      $now: now,
    }) as { id: number; localized_cmd: string } | undefined;
    if (claimed) {
      this.log.info("Claimed job", { jobId: claimed.id, leaseUntil });
    }
    return claimed
      ? { id: claimed.id, localizedCmd: claimed.localized_cmd }
      : null;
  }

  enqueueUnique(job: Job): { id: number } | null {
    const existing = this._getJobIdWithLocalizedCmd.get({
      $localized_cmd: job.localizedCmd,
    }) as { id: number } | undefined;
    if (existing) {
      return null;
    }

    return this.enqueue(job);
  }

  enqueue(job: Job): { id: number } | null {
    const result = this._enqueue.get({
      $raw_cmd: job.rawCmd,
      $localized_cmd: job.localizedCmd,
      $input_file: job.inputFile,
      $status: job.status,
    }) as { id: number } | undefined;
    return result ? { id: result.id } : null;
  }

  updateStatus(localizedCmd: string, status: JobStatus): void {
    this._updateStatus.run({
      $localized_cmd: localizedCmd,
      $status: status,
    });
  }
}

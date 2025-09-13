import type { IJobsRepository } from "@/jobs/core/ijobs-repository";
import type { Job } from "@/jobs/core/job";
import type { JobStatus } from "@/jobs/core/job-status";
import { jobsManager } from "@/infra/db";
import { JOB_STATUS } from "@/jobs";

export class JobsRepository implements IJobsRepository {
  private _enqueue: typeof jobsManager.enqueue;
  private _updateStatus: typeof jobsManager.updateStatus;
  private _changeStatusFrom: typeof jobsManager.changeStatusFrom;
  private _setSuccess: typeof jobsManager.setSuccess;
  private _setFail: typeof jobsManager.setFail;
  private _setRunning: typeof jobsManager.setRunning;
  private _getJobIdWithLocalizedCmd: typeof jobsManager.getJobIdWithLocalizedCmd;
  private _claim: typeof jobsManager.claim;

  constructor() {
    this._enqueue = jobsManager.enqueue;
    this._updateStatus = jobsManager.updateStatus;
    this._changeStatusFrom = jobsManager.changeStatusFrom;
    this._setSuccess = jobsManager.setSuccess;
    this._setFail = jobsManager.setFail;
    this._setRunning = jobsManager.setRunning;
    this._getJobIdWithLocalizedCmd = jobsManager.getJobIdWithLocalizedCmd;
    this._claim = jobsManager.claim;
  }
  setJobsPending(inputFile: string): void {
    this.changeStatusFrom(
      inputFile,
      JOB_STATUS.MISSING_INPUT,
      JOB_STATUS.PENDING
    );
  }
  setJobsMissingInput(inputFile: string): void {
    this.changeStatusFrom(
      inputFile,
      JOB_STATUS.PENDING,
      JOB_STATUS.MISSING_INPUT
    );
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

  claim(
    wid: number,
    leaseUntil?: number
  ): { id: number; localizedCmd: string } | null {
    const now = Date.now();
    leaseUntil = leaseUntil ?? now + 1000 * 60 * 60 * 3;
    const claimed = this._claim.get({
      $wid: wid,
      $lease: leaseUntil,
      $now: now,
    }) as { id: number; localized_cmd: string } | undefined;
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
  changeStatusFrom(
    inputFile: string,
    oldStatus: JobStatus,
    newStatus: JobStatus
  ): void {
    this._changeStatusFrom.run({
      $input_file: inputFile,
      $old_status: oldStatus,
      $new_status: newStatus,
    });
  }
}

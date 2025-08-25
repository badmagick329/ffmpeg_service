import type { IJobsRepository } from "../../core/ijobs-repository";
import type { Job, JobStatus } from "../../core/job";
import { jobsManager } from "../db";

export class JobsRepository implements IJobsRepository {
  private _enqueue: typeof jobsManager.enqueue;
  private _updateStatus: typeof jobsManager.updateStatus;
  private _changeStatusFrom: typeof jobsManager.changeStatusFrom;
  private _getJobIdWithLocalizedCmd: typeof jobsManager.getJobIdWithLocalizedCmd;
  private _claim: typeof jobsManager.claim;

  constructor() {
    this._enqueue = jobsManager.enqueue;
    this._updateStatus = jobsManager.updateStatus;
    this._changeStatusFrom = jobsManager.changeStatusFrom;
    this._getJobIdWithLocalizedCmd = jobsManager.getJobIdWithLocalizedCmd;
    this._claim = jobsManager.claim;
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

  updateStatus(inputFile: string, status: JobStatus): void {
    this._updateStatus.run({
      $input_file: inputFile,
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

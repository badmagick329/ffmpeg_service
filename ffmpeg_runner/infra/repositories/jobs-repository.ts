import type { IJobsRepository } from "../../core/ijobs-repository";
import type { Job, JobStatus } from "../../core/job";
import { jobsManager } from "../db";

export class JobsRepository implements IJobsRepository {
  private _enqueue: typeof jobsManager.enqueue;
  private _updateStatus: typeof jobsManager.updateStatus;
  private _updateStatusFrom: typeof jobsManager.updateStatusFrom;

  constructor() {
    this._enqueue = jobsManager.enqueue;
    this._updateStatus = jobsManager.updateStatus;
    this._updateStatusFrom = jobsManager.updateStatusFrom;
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
  updateStatusFrom(
    inputFile: string,
    oldStatus: JobStatus,
    newStatus: JobStatus
  ): void {
    this._updateStatusFrom.run({
      $input_file: inputFile,
      $old_status: oldStatus,
      $new_status: newStatus,
    });
  }
}

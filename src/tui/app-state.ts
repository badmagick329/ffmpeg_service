import type { JobStatus } from "@/jobs/core/job-status";
import { EventEmitter } from "events";

export interface JobInfo {
  id: number;
  command: string;
  status: JobStatus;
  startTime?: number;
}

export interface AppEvent {
  timestamp: number;
  type: string;
  message: string;
}

export const APP_EVENT_TYPE = {
  CHANGE: "change",
} as const;
export type AppEventType = (typeof APP_EVENT_TYPE)[keyof typeof APP_EVENT_TYPE];

export interface AppStateData {
  currentJob: JobInfo | null;
  lastAddedJob: JobInfo | null;
  jobCounts: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  recentEvents: AppEvent[];
}

export class AppState extends EventEmitter {
  private state: AppStateData = {
    currentJob: null,
    lastAddedJob: null,
    jobCounts: { pending: 0, running: 0, completed: 0, failed: 0 },
    recentEvents: [],
  };

  getState(): Readonly<AppStateData> {
    return { ...this.state };
  }

  setCurrentJob(job: JobInfo | null) {
    this.state.currentJob = job;
    this.emit(APP_EVENT_TYPE.CHANGE, this.state);
  }

  setLastAddedJob(job: JobInfo) {
    this.state.lastAddedJob = job;
    this.state.jobCounts.pending++;
    this.emit(APP_EVENT_TYPE.CHANGE, this.state);
  }

  updateJobStatus(cmd: string, status: JobStatus) {
    if (this.state.currentJob && this.state.currentJob.command === cmd) {
      this.state.currentJob.status = status;
    }
    if (this.state.lastAddedJob && this.state.lastAddedJob.command === cmd) {
      this.state.lastAddedJob.status = status;
    }
    this.emit(APP_EVENT_TYPE.CHANGE, this.state);
  }

  // incrementCompleted() {
  //   this.state.jobCounts.completed++;
  //   this.state.jobCounts.running--;
  //   this.emit(APP_EVENT_TYPE.CHANGE, this.state);
  // }

  // incrementFailed() {
  //   this.state.jobCounts.failed++;
  //   this.state.jobCounts.running--;
  //   this.emit(APP_EVENT_TYPE.CHANGE, this.state);
  // }

  startJob() {
    this.state.jobCounts.running++;
    this.state.jobCounts.pending--;
    this.emit(APP_EVENT_TYPE.CHANGE, this.state);
  }

  addLogEvent(level: string, message: string) {
    this.state.recentEvents.push({
      timestamp: Date.now(),
      type: level,
      message,
    });
    this.state.recentEvents = this.state.recentEvents.slice(-10);
    this.emit(APP_EVENT_TYPE.CHANGE, this.state);
  }
}

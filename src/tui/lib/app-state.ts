import type { JobStatus } from "@/jobs/core/job-status";
import { EventEmitter } from "events";

export type StatusCount = {
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
};

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
  statusCount: StatusCount;
  recentEvents: AppEvent[];
}

export interface IAppState {
  getState(): Readonly<AppStateData>;
  batch(fn: () => void): void;
  setCurrentJob(job: JobInfo | null): void;
  setLastAddedJob(job: JobInfo): void;
  updateJobStatus(cmd: string, status: JobStatus): void;
  updateJobStatusCount(statusCount: StatusCount): void;
  addLogEvent(level: string, message: string): void;
}

export class AppState extends EventEmitter implements IAppState {
  private state: AppStateData = {
    currentJob: null,
    lastAddedJob: null,
    statusCount: {
      pending: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
    },
    recentEvents: [],
  };

  private batchDepth = 0;
  private shouldEmit = false;

  getState(): Readonly<AppStateData> {
    return { ...this.state };
  }

  batch(fn: () => void) {
    this.batchDepth++;
    try {
      fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.shouldEmit) {
        this.shouldEmit = false;
        this.emit(APP_EVENT_TYPE.CHANGE, this.state);
      }
    }
  }

  private emitChange() {
    if (this.batchDepth > 0) {
      this.shouldEmit = true;
    } else {
      this.emit(APP_EVENT_TYPE.CHANGE, this.state);
    }
  }

  setCurrentJob(job: JobInfo | null) {
    this.state.currentJob = job;
    this.emitChange();
  }

  setLastAddedJob(job: JobInfo) {
    this.state.lastAddedJob = job;
    this.emitChange();
  }

  updateJobStatus(cmd: string, status: JobStatus) {
    if (this.state.currentJob && this.state.currentJob.command === cmd) {
      this.state.currentJob.status = status;
    }
    if (this.state.lastAddedJob && this.state.lastAddedJob.command === cmd) {
      this.state.lastAddedJob.status = status;
    }
    this.emitChange();
  }

  updateJobStatusCount(statusCount: StatusCount) {
    this.state.statusCount = statusCount;
    this.emitChange();
  }

  addLogEvent(level: string, message: string) {
    this.state.recentEvents.push({
      timestamp: Date.now(),
      type: level,
      message,
    });
    this.state.recentEvents = this.state.recentEvents.slice(-10);
    this.emitChange();
  }
}

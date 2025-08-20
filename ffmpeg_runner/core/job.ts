export const JOB_STATUS = {
  MISSING_INPUT: "missing_input",
  PENDING: "pending",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
} as const;

export type Job = {
  rawCmd: string;
  localizedCmd: string;
  inputFile: string;
  status: (typeof JOB_STATUS)[keyof typeof JOB_STATUS];
};

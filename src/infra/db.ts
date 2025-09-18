import { Database } from "bun:sqlite";
import { JOB_STATUS } from "@/jobs";

const _db = new Database("ffmpeg_service.db");
const statusValues = Object.values(JOB_STATUS)
  .map((s) => `'${s}'`)
  .join(",");

_db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
CREATE TABLE IF NOT EXISTS jobs (
  id              INTEGER PRIMARY KEY,
  raw_cmd         TEXT NOT NULL,
  localized_cmd   TEXT NOT NULL,
  input_file      TEXT NOT NULL,
  status          TEXT NOT NULL CHECK(status IN (${statusValues})),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  locked_by       TEXT,
  lease_until     INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_lease  ON jobs(lease_until);
CREATE INDEX IF NOT EXISTS idx_jobs_input_files ON jobs(input_file);
CREATE TABLE IF NOT EXISTS input_files (
  id              INTEGER PRIMARY KEY,
  input_file      TEXT NOT NULL UNIQUE,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_input_files_input_files  ON input_files(input_file);
`);

const inpAdd = _db.query(
  `INSERT OR IGNORE INTO input_files(input_file)
  VALUES($input_file) RETURNING id,input_file`
);

const inpRemove = _db.query(
  `DELETE FROM input_files WHERE input_file=$input_file RETURNING id,input_file`
);
const inpListAll = _db.query(`SELECT input_file FROM input_files`);
const inpGetByInputFile = _db.query(
  `SELECT input_file FROM input_files WHERE input_file=$input_file`
);

const qEnq = _db.query(
  `INSERT OR IGNORE INTO jobs(raw_cmd, localized_cmd, input_file, status)
  VALUES($raw_cmd, $localized_cmd, $input_file, $status) RETURNING id`
);

const qStatusUpdate = _db.query(
  `UPDATE jobs SET status=$status, updated_at=unixepoch() WHERE localized_cmd=$localized_cmd`
);

const qStatusUpdateFrom = _db.query(
  `UPDATE jobs SET status=$new_status, updated_at=unixepoch()
   WHERE input_file=$input_file AND status=$old_status`
);

const qGetJobIdWithLocalizedCmd = _db.query(
  `SELECT id FROM jobs WHERE localized_cmd=$localized_cmd`
);

const qGetByInputFile = _db.query(
  `SELECT * FROM jobs WHERE input_file=$input_file`
);

const qClaim = _db.query(
  `
  UPDATE jobs
    SET status='running',
      attempts = attempts + 1,
      locked_by=$wid,
      lease_until=$lease,
      updated_at=unixepoch()
  WHERE id = (
    SELECT j.id 
    FROM jobs j
    WHERE 
      EXISTS (
        SELECT 1 
        FROM input_files f
        WHERE f.input_file = j.input_file
      ) 
      AND (
      j.status='pending'
      OR (j.status='running' AND (j.lease_until IS NULL OR j.lease_until <= $now)))
    ORDER BY j.created_at
    LIMIT 1
  ) 
  AND (
    status = 'pending'
    OR (status='running' AND (lease_until IS NULL OR lease_until <= $now))
  )
  RETURNING id, localized_cmd`
);

const qOk = _db.query(
  `UPDATE jobs SET status='succeeded', locked_by=NULL, lease_until=NULL,
                   updated_at=unixepoch() WHERE id=$id`
);

const qFail = _db.query(
  `UPDATE jobs SET status='failed', last_error=$err, locked_by=NULL, lease_until=NULL,
                   updated_at=unixepoch() WHERE id=$id`
);

const qRunning = _db.query(
  `UPDATE jobs SET status='running', updated_at=unixepoch() WHERE id=$id`
);

export const jobsManager = {
  enqueue: qEnq,
  claim: qClaim,
  setSuccess: qOk,
  setFail: qFail,
  setRunning: qRunning,
  updateStatus: qStatusUpdate,
  changeStatusFrom: qStatusUpdateFrom,
  getByInputFile: qGetByInputFile,
  getJobIdWithLocalizedCmd: qGetJobIdWithLocalizedCmd,
};

export const inputFilesManager = {
  add: inpAdd,
  remove: inpRemove,
  listAll: inpListAll,
  getByInputFile: inpGetByInputFile,
};

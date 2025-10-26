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
  input_file      TEXT PRIMARY KEY,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
) WITHOUT ROWID;
`);

const inpAdd = _db.query(
  `INSERT OR IGNORE INTO input_files(input_file)
  VALUES($input_file) RETURNING input_file`
);

const inpRemove = _db.query(
  `DELETE FROM input_files WHERE input_file=$input_file RETURNING input_file`
);
const inpGetByInputFile = _db.query(
  `SELECT input_file FROM input_files WHERE input_file=$input_file`
);
const inpReconcile = (files: string[]) => {
  _db.exec("BEGIN IMMEDIATE;");

  try {
    _db.exec("DROP TABLE IF EXISTS temp.scan;");
    _db.exec(
      `CREATE TEMP TABLE scan 
      (
      input_file TEXT PRIMARY KEY
      ) WITHOUT ROWID;
    `
    );

    const insertScan = _db.prepare(
      "INSERT INTO scan(input_file) VALUES ($input_file)"
    );
    for (const f of files) {
      insertScan.run({ $input_file: f });
    }

    _db.exec(`
      INSERT OR IGNORE INTO input_files(input_file)
      SELECT input_file FROM scan;
    `);

    _db.exec(`
      DELETE FROM input_files
      WHERE NOT EXISTS (
        SELECT 1 FROM scan s WHERE s.input_file = input_files.input_file
      );
    `);

    _db.exec("COMMIT;");
  } catch (err) {
    _db.exec("ROLLBACK;");
    throw err;
  }
};

const qEnq = _db.query(
  `INSERT OR IGNORE INTO jobs(raw_cmd, localized_cmd, input_file, status)
  VALUES($raw_cmd, $localized_cmd, $input_file, $status) RETURNING id, created_at`
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
  WITH selected_job AS (
    SELECT j.id, j.status as old_status, j.localized_cmd
    FROM jobs j
    WHERE 
      EXISTS (
        SELECT 1 
        FROM input_files f
        WHERE f.input_file = j.input_file
      ) 
      AND (
      j.status='${JOB_STATUS.PENDING}'
      OR (j.status='${JOB_STATUS.RUNNING}' AND (j.lease_until IS NULL OR j.lease_until <= $now)))
    ORDER BY j.created_at
    LIMIT 1
  )
  UPDATE jobs
    SET status='${JOB_STATUS.RUNNING}',
      attempts = attempts + 1,
      locked_by=$wid,
      lease_until=$lease,
      updated_at=unixepoch()
  WHERE id = (SELECT id FROM selected_job)
  AND (
    status = '${JOB_STATUS.PENDING}'
    OR (status='${JOB_STATUS.RUNNING}' AND (lease_until IS NULL OR lease_until <= $now))
  )
  RETURNING id, localized_cmd, created_at, (SELECT old_status FROM selected_job) as old_status`
);

const qOk = _db.query(
  `UPDATE jobs SET status='${JOB_STATUS.SUCCEEDED}', locked_by=NULL, lease_until=NULL,
                   updated_at=unixepoch() WHERE id=$id`
);

const qFail = _db.query(
  `UPDATE jobs SET status='${JOB_STATUS.FAILED}', last_error=$err, locked_by=NULL, lease_until=NULL,
                   updated_at=unixepoch() WHERE id=$id`
);

const qRunning = _db.query(
  `UPDATE jobs SET status='${JOB_STATUS.RUNNING}', updated_at=unixepoch() WHERE id=$id`
);

const qStatusCount = _db.query(
  `SELECT status, COUNT(*) as count FROM jobs GROUP BY status`
);

export const jobsManager = {
  enqueue: qEnq,
  claim: qClaim,
  setSuccess: qOk,
  setFail: qFail,
  setRunning: qRunning,
  changeStatusFrom: qStatusUpdateFrom,
  getByInputFile: qGetByInputFile,
  getJobIdWithLocalizedCmd: qGetJobIdWithLocalizedCmd,
  getStatusCount: qStatusCount,
};

export const inputFilesManager = {
  add: inpAdd,
  remove: inpRemove,
  getByInputFile: inpGetByInputFile,
  reconcile: inpReconcile,
};

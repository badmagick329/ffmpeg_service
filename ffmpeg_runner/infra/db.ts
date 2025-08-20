import { Database } from "bun:sqlite";

const _db = new Database("ffmpeg_service.db");

_db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
CREATE TABLE IF NOT EXISTS jobs (
  id              INTEGER PRIMARY KEY,
  raw_cmd         TEXT NOT NULL,
  localized_cmd   TEXT NOT NULL,
  input_file      TEXT NOT NULL,
  status          TEXT NOT NULL CHECK(status IN ('missing_input','pending','running','succeeded','failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  locked_by       TEXT,
  lease_until     INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_lease  ON jobs(lease_until);
CREATE INDEX IF NOT EXISTS idx_jobs_filepath ON jobs(input_file);
CREATE TABLE IF NOT EXISTS input_files (
  id              INTEGER PRIMARY KEY,
  input_file      TEXT NOT NULL UNIQUE,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_input_files_filepath  ON input_files(input_file);
`);

const inpAdd = _db.query(
  `INSERT OR IGNORE INTO input_files(input_file)
  VALUES($filepath) RETURNING id,input_file`
);

const inpRemove = _db.query(
  `DELETE FROM input_files WHERE input_file=$filepath`
);
const inpListAll = _db.query(`SELECT input_file FROM input_files`);
const inpGetByFilepath = _db.query(
  `SELECT input_file FROM input_files WHERE input_file=$filepath`
);

const qEnq = _db.query(
  `INSERT OR IGNORE INTO jobs(raw_cmd, localized_cmd, input_file, status)
  VALUES($raw_cmd, $localized_cmd, $input_file, $status)`
);

const qStatusUpdate = _db.query(
  `UPDATE jobs SET status=$status, updated_at=unixepoch() WHERE input_file=$input_file`
);

const qGetByFilepath = _db.query(
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
  WHERE id in (
  SELECT id FROM jobs
  WHERE status='pending'
    OR (status='running' AND (lease_until IS NULL OR lease_until <= $now))
  ORDER BY created_at
  LIMIT 1
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

export const jobsManager = {
  enqueue: qEnq,
  claim: qClaim,
  setSuccess: qOk,
  setFail: qFail,
  updateStatus: qStatusUpdate,
  getByFilepath: qGetByFilepath,
};

export const inputFilesManager = {
  add: inpAdd,
  remove: inpRemove,
  listAll: inpListAll,
  getByFilepath: inpGetByFilepath,
};

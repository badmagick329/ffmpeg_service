# FFmpeg Service

Offload FFmpeg encoding jobs to remote servers (homelab, VPS, etc.) with automatic file transfer and job tracking.

Write FFmpeg commands using your local file paths, and the service handles everything else: uploading inputs to the server, executing the encode, and downloading the finished outputs back to your machine.

<img width="1901" height="758" alt="image" src="https://github.com/user-attachments/assets/9f75c0cc-5ff7-4a2d-8cb6-fb083170b538" />


## Features

- **Automatic file transfer** - Input files are uploaded via SFTP, outputs are downloaded when ready
- **Path translation** - Write commands with local paths, the system translates them for the server and back
- **Multi-server support** - Distribute work across multiple servers by naming your command files
- **Job tracking** - Client maintains state to resume interrupted transfers and track pending downloads
- **Server TUI** - Real-time job status display on the server
- **Docker support** - Optionally run FFmpeg in a container instead of installing it on the server

## Prerequisites

- **[Bun](https://bun.sh/docs/installation)** - Required on both client and server
- **Linux server** - The server-side component requires Linux
- **SSH key pair** - Key-based authentication only (no password auth)
- **FFmpeg** - Must be available on the server (or use the Docker option)

## Quick Start

### 1. Configure the server

On your remote server, clone the repo and set up the config:

```sh
git clone https://github.com/badmagick329/ffmpeg_service
cd ffmpeg_service
cp config.toml.sample config.toml
# Edit config.toml - the defaults work for most setups
```

### 2. Start the server

```sh
bun install
```

**Recommended:** Run as a low-priority process so encoding only uses idle resources:

```sh
ionice -c3 nice -n 19 bun run ./src/server.ts
# Alternatively:
# bun run ./src/server.ts
```

### 3. Configure the client

On your local machine, set up the config with your server details:

```sh
cp config.toml.sample config.toml
```

Edit `config.toml` and add at least one `[[client.remotes]]` entry:

```toml
[[client.remotes]]
serverName = "myserver"
sshHostIP = "192.168.1.100"
sshUser = "username"
sshKeyPath = "C:\\Users\\YourUser\\.ssh\\id_rsa"
remoteWorkDir = "/home/username/ffmpeg_service"
remoteCmdsDir = "/home/username/ffmpeg_service/data/cmds"
remoteSuccessDir = "/home/username/ffmpeg_service/work/success"
copyTo = "/home/username/ffmpeg_service/work/videos"
copyFrom = "/home/username/ffmpeg_service/work/videos_out"
```

### 4. Create a command file

Create a text file in the `data/cmds/` directory. The filename **must contain your server name** (see [Server Routing](#server-routing-by-filename)).

Example: `data/cmds/encode_batch_myserver.txt`

```
ffmpeg -i "D:\Videos\input1.mkv" -c:v libx264 -crf 23 "D:\Videos\output1.mkv"
ffmpeg -i "D:\Videos\input2.mkv" -c:v libx264 -crf 23 "D:\Videos\output2.mkv"
# This is a comment - lines starting with # are ignored
```

> **Note:** Use your local absolute paths. The service translates them automatically.

### 5. Run the client

```sh
bun install  # first time only
bun run ./src/client.ts
```

The client performs three steps each time you run it:

1. **Download completed outputs** - Checks for finished jobs and downloads the output files
2. **Dispatch new commands** - Uploads input files and command files to the server
3. **Cleanup prompt** - Offers to remove server-side input files that are no longer needed

Run the client periodically (or whenever you want to check progress) to download completed files and dispatch new work.

## Server Routing by Filename

When you configure multiple servers, the client determines which server to use based on the **command filename**.

The `serverName` from your config must appear somewhere in the filename:

| Server Name | Valid Filenames                                                   |
| ----------- | ----------------------------------------------------------------- |
| `homelab`   | `encode_homelab.txt`, `homelab_batch1.ps1`, `my_homelab_jobs.cmd` |
| `vps1`      | `vps1_encode.txt`, `batch_vps1.txt`                               |

- The match is **case-sensitive**
- The extension doesn't matter (`.txt`, `.ps1`, `.cmd`, etc. any text file works)
- If no server name is found in the filename, the file is skipped and logged as a failure
- Choose distinctive server names to avoid accidental matches

### Workload Distribution

You can distribute encoding work across multiple servers by creating separate command files:

```
data/cmds/
├── batch1_homelab.txt    → routes to "homelab" server
├── batch2_vps1.txt       → routes to "vps1" server
└── batch3_vps2.txt       → routes to "vps2" server
```

This lets you manually balance load or assign specific jobs to servers with different hardware.

## Command Format

Commands must have a quoted input path (after `-i`) and a quoted output path at the end:

```
ffmpeg -i "/path/to/input.mkv" [options] "/path/to/output.mkv"
```

### Examples

Basic x264 encode:

```
ffmpeg -i "D:\Videos\source.mkv" -c:v libx264 -crf 23 -preset medium -c:a copy "D:\Videos\encoded.mkv"
```

With filters:

```
ffmpeg -i "C:\Media\raw.mp4" -c:v libx264 -vf "scale=1920:1080,fps=30" -c:a aac "C:\Media\processed.mp4"
```

Using the Docker wrapper (see [Running FFmpeg with Docker](#running-ffmpeg-with-docker)):

```
./ffx.sh -i "/home/user/video.mkv" -c:v libx264 -crf 24 "/home/user/output.mkv"
```

### Notes

- **Use absolute paths** - Relative paths may not translate correctly
- **Use your local paths** - Write paths as they exist on your machine; the service handles translation
- **Flags auto-injected** - The service adds `-y -hide_banner -nostdin` if missing
- **Comments** - Lines starting with `#` are ignored (regardless of file extension)

## How It Works

### Client Workflow

Each time you run the client, it performs these steps in order:

```
┌─────────────────────────────────────────────────────────────┐
│  1. DOWNLOAD COMPLETED OUTPUTS                              │
│     • Check each server for success marker files            │
│     • Download finished outputs to local paths              │
│     • Update client state                                   │
├─────────────────────────────────────────────────────────────┤
│  2. DISPATCH NEW COMMANDS                                   │
│     • Scan data/cmds/ for command files                     │
│     • Match files to servers by filename                    │
│     • Upload referenced input files via SFTP                │
│     • Copy command files to server                          │
│     • Record pending downloads in client state              │
├─────────────────────────────────────────────────────────────┤
│  3. CLEANUP (interactive)                                   │
│     • Identify uploaded input files no longer needed        │
│     • Prompt to delete them from server                     │
└─────────────────────────────────────────────────────────────┘
```

### Server Workflow

The server runs continuously, watching for new work:

1. **Watch directories** — Monitors `cmdsInputDir` for command files and `incomingDir` for input files
2. **Claim jobs** — When a command file appears and its input file is available, claim the job
3. **Execute FFmpeg** — Run the command and capture output
4. **Mark completion** — On success, write a marker file (`<output>.<successFlag>`) to `successDir`
5. **Display status** — The TUI shows real-time job progress

### Success Detection

The client knows a job is complete by checking for **success marker files**:

- When FFmpeg finishes successfully, the server writes a file like `output.mkv.done` to `successDir`
- The client checks `successDir` for these markers to identify completed jobs
- The `successFlag` (default: `done`) is configurable in `config.toml`

## Configuration Reference

Copy `config.toml.sample` to `config.toml` and edit as needed.

### Server Settings

| Key               | Description                                    |
| ----------------- | ---------------------------------------------- |
| `incomingDir`     | Directory for uploaded input files             |
| `outgoingDir`     | Directory for completed output files           |
| `successDir`      | Directory for success marker files             |
| `jobPollInterval` | How often to check for new jobs (milliseconds) |

### Client Settings

| Key            | Description                               |
| -------------- | ----------------------------------------- |
| `stateFile`    | Path to client state JSON file            |
| `cmdsInputDir` | Local directory to scan for command files |

### Remote Server Config (`[[client.remotes]]`)

| Key                | Required | Description                                                             |
| ------------------ | -------- | ----------------------------------------------------------------------- |
| `serverName`       | ✓        | Unique identifier used for routing (alphanumeric, hyphens, underscores) |
| `sshHostIP`        | ✓        | Server IP address or hostname                                           |
| `sshUser`          | ✓        | SSH username                                                            |
| `sshKeyPath`       | ✓        | Path to private SSH key                                                 |
| `remoteWorkDir`    | ✓        | Base directory on server                                                |
| `remoteCmdsDir`    | ✓        | Server directory for command files                                      |
| `remoteSuccessDir` | ✓        | Server directory for success markers                                    |
| `copyTo`           | ✓        | Server directory for input files                                        |
| `copyFrom`         | ✓        | Server directory for output files                                       |

## Running FFmpeg with Docker

If you don't want to install FFmpeg directly on the server, use the included Docker setup:

1. Copy `docker-compose.yaml.sample` to `docker-compose.yaml`
2. Use `./ffx.sh` instead of `ffmpeg` in your commands.

```
./ffx.sh -i "D:\Videos\input.mkv" -c:v libx264 -crf 24 "D:\Videos\output.mkv"
```

## Logs & Monitoring

- **Server logs** - Written to the `logDir` path using Winston with daily rotation
- **Server TUI** - Displays job counts, recent events, and currently running jobs
- **Client output** - Progress is printed to stdout during each run

## Troubleshooting

| Problem                    | Solution                                                       |
| -------------------------- | -------------------------------------------------------------- |
| Commands not executing     | Check server logs in `logDir`; verify input files are uploaded |
| SSH connection fails       | Verify `sshKeyPath` is readable and the key has no passphrase  |
| No server matched for file | Ensure filename contains a configured `serverName`             |
| Downloads not happening    | Check `successDir` on server for marker files                  |
| Permission errors          | Ensure SSH user has write access to all configured directories |

## Contributing

Contributions are welcome! Feel free to open a PR or Issue.

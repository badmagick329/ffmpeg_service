# FFmpeg Service

A small client/server system to offload FFmpeg work to remote servers (homelab, VPS, etc.).
The server watches a commands directory and executes FFmpeg commands placed there when the input files become available server side. The optional client copies input files and command files to the server, records state, and later downloads outputs and performs cleanup.

## Quickstart

Prereqs

- Bun: required. See https://bun.com/docs/installation for the latest install instructions.
- Server side requires Linux.
- An SSH keypair for the server (key-based auth only).
- ffmpeg available on the server (or use the provided Docker Compose sample to run ffmpeg in a container).

1. Copy `config.toml.sample` to `config.toml` and edit the `remoteConfigs` and other values as needed.

2. Start the server on your remote host:

```sh
# from the repository root on the server
bun run ./src/server.ts
# RECOMMENDED:
# Run as a low priority cpu/memory process. This ensures the service is only using up idle resources
ionice -c3 nice -n 19 bun run ./src/server.ts
```

3. From your client machine, create a commands file containing one or more ffmpeg commands (see "Command format" below).

4. Run the client to dispatch the commands and upload inputs:

```sh
bun run ./src/client.ts
```

5. Run the client again later to fetch completed outputs and clean up server-side input files.

## Important concepts

- copyTo: the directory on the server where the server watches for input files (server's incoming dir). The client uploads input files to this location.
- copyFrom: the directory on the server where completed output files are deposited. The client downloads outputs from here.
- cmdsInputDir: the directory the server watches for command files (ffmpeg commands). The client copies command files into this directory when dispatching jobs.
- successFlag: a short extension used to indicate successful completion; the server writes a file named `<output>.<successFlag>` into the `successDir` when a job succeeds. The client uses this to find out which jobs have completed.

## Command format and examples

Commands must follow the expected shape the app parses. The parser expects a command that contains a quoted input path and a quoted output path. Using absolute paths is recommended.

Examples:

```
ffmpeg -y -i "/absolute/path/to/input.mkv" -c:v libx264 -crf 24 -preset slow -c:a copy "/absolute/path/to/output.mkv"
```

```
./ffx.sh -i "/home/user/videos/input.mkv" -c:v libx264 -vf crop=1080:1080:480:0 "/home/user/videos/output.mkv"
```

Note: The code will inject `-y -hide_banner -nostdin` flags if they are missing.

## Configuration

Configuration options are listed in `config.toml.sample`. Copy it to `config.toml` and edit values for your environment. Key fields to check:

- `remoteWorkDir` — base directory on the server where the service runs.
- `cmdsInputDir` — commands directory the server and client watches.
- `incomingDir` / `outgoingDir` — used for input and output handling on the server.
- `successDir` and `successFlag` — where success marker files are written.
- `remoteConfigs` — on the client, list of servers with `sshHostIP`, `sshUser`, and `sshKeyPath` for key-based auth.

`config.toml.sample` with sane defaults is included.

## Transfer & Auth

- The client uses SFTP for file transfers
- SSH key-based auth is required and supported (the transfer client reads the private key path from the config).

## How it works (high level architecture)

- Client-side:

  - Reads `config.toml` and client-state
  - Uploads input files to server `copyTo` location and copies command files into `cmdsInputDir` on the server.
  - Records state so repeated client runs can later download outputs and cleanup unused input file(managed via `ClientStateJsonStorage` / `ClientStateManager`). Key pointsds.

- Server-side:
  - Watches `cmdsInputDir` and `incomingDir` for new commands and files.
  - Claims jobs and executes FFmpeg via Bun (the `FFmpegJobExecutor` reads job info, translates paths, and spawns `ffmpeg`).
  - On success, writes `<output>.<successFlag>` into `successDir` and updates job lifecycle status.
  - A small TUI runs on the server to show job states and recent events. Detailed logs are written to the configured logs path.

## Running with Docker (optional for ffmpeg only)

If the server host doesn't want to install ffmpeg, the repo includes `docker-compose.yaml.sample` which runs an ffmpeg container. The shell script (`ffx.sh`, `ffx.ps1`) call `docker compose run --rm ffmpeg` as a helper to execute ffmpeg through Docker. Note: Windows support for the helper scripts is not fully implemented.

## Logs & Monitoring

- The server writes application logs using `winston` and `winston-daily-rotate-file`. See `config.toml` (the `logConfig` section) for where logs are stored.
- The TUI (`src/tui`) starts with the server and shows a basic job overview. Use that for quick local monitoring on the server.

## Troubleshooting

- If commands fail to run, check the server logs and the success files in `successDir`.
- Ensure the private SSH key path in `config.toml` is readable by the process running the client.

## Contributing

Contribution is welcome. Feel free to open a PR or an Issue.

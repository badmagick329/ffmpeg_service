param([Parameter(ValueFromRemainingArguments = $true)] [string[]]$Args)
docker compose run --rm ffmpeg @Args

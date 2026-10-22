# Optional helper for machines whose system Node is older than the project needs.
# Usage (Git Bash):  source learning-site/scripts/local-env.sh
#
# - Prefers a portable Node in learning-site/.tools/node/ when one exists (gitignored).
# - Keeps npm's cache, temp files and Playwright browsers inside learning-site/.cache/ (gitignored),
#   which helps when the system drive is short on space.
LS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -x "$LS_ROOT/.tools/node/node.exe" ] || [ -x "$LS_ROOT/.tools/node/bin/node" ]; then
  export PATH="$LS_ROOT/.tools/node:$LS_ROOT/.tools/node/bin:$PATH"
fi
mkdir -p "$LS_ROOT/.cache/npm" "$LS_ROOT/.cache/tmp" "$LS_ROOT/.cache/ms-playwright"
export npm_config_cache="$LS_ROOT/.cache/npm"
export TEMP="$LS_ROOT/.cache/tmp" TMP="$LS_ROOT/.cache/tmp" TMPDIR="$LS_ROOT/.cache/tmp"
export PLAYWRIGHT_BROWSERS_PATH="$LS_ROOT/.cache/ms-playwright"
export ASTRO_TELEMETRY_DISABLED=1

# Portable .NET SDK for the C# runner (learning-site/.tools/dotnet/, gitignored), when one exists.
# Installed with Microsoft's dotnet-install script; see runner/NOTES.md. Caches stay under .cache/.
if [ -x "$LS_ROOT/.tools/dotnet/dotnet.exe" ] || [ -x "$LS_ROOT/.tools/dotnet/dotnet" ]; then
  export DOTNET_ROOT="$LS_ROOT/.tools/dotnet"
  export PATH="$LS_ROOT/.tools/dotnet:$PATH"
fi
mkdir -p "$LS_ROOT/.cache/nuget"
export NUGET_PACKAGES="$LS_ROOT/.cache/nuget"
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
export DOTNET_CLI_HOME="$LS_ROOT/.cache/dotnet-home"

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

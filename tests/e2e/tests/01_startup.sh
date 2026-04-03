#!/usr/bin/env bash
# Startup appearance tests — no API calls required.
# Verifies that visual patches render correctly on initial startup:
#   - patchesAppliedIndication: tweakcc indicator + version in header
#   - hideStartupBanner: "Welcome to Claude Code" suppressed
#   - hideStartupClawd: clawd ASCII art suppressed

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

section "Startup / Initial Render"

S=$(new_session "startup")
start_claude "$S"

if ! wait_for_claude_ready "$S" 15; then
  fail "claude startup" "timed out after 15s — claude did not render"
  kill_session "$S"
  summary
  exit $?
fi

# patchesAppliedIndication — tweakcc version in header (requires showTweakccVersion: true in config)
assert_present "$S" "+ tweakcc v"          "patchesAppliedIndication: tweakcc version in header"

# hideStartupBanner (requires hideStartupBanner: true in config)
assert_absent  "$S" "Welcome to Claude Code" "hideStartupBanner: banner suppressed"

# hideStartupClawd (requires hideStartupClawd: true in config)
# Uses the distinctive block art pattern from the clawd component
assert_absent  "$S" "▛███▜"               "hideStartupClawd: clawd ASCII art suppressed"

quit_claude "$S"
kill_session "$S"

summary

#!/usr/bin/env bash
# Additional startup tests — no API calls required.
# Tests patches with visible effects on initial render or startup behavior.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

section "Startup — Extra"

# ============================================================
# skip-trust-dialog
# Launching claude in an untrusted directory normally shows
# "Accessing workspace" dialog. With patch, it skips straight through.
# We use a fresh temp dir that's not in the trusted list.
# ============================================================
TRUST_DIR=$(mktemp -d)
trap "rm -rf '$TRUST_DIR'" EXIT

if tweakcc_enabled "misc.skipTrustDialog"; then
  S=$(new_session "trust")
  tmux send-keys -t "$S" "cd '$TRUST_DIR' && claude" Enter

  if ! wait_for_claude_ready "$S" 15; then
    fail "skipTrustDialog: claude started in untrusted dir" "startup timeout"
  else
    assert_absent "$S" "Accessing workspace" "skipTrustDialog: trust dialog suppressed"
    assert_absent "$S" "Trust workspace"     "skipTrustDialog: trust dialog suppressed (alt text)"
  fi
  quit_claude "$S"
  kill_session "$S"
else
  skip "skipTrustDialog" "misc.skipTrustDialog not enabled in config"
fi

# ============================================================
# patches-applied-indication — regression check
# Config has showTweakccVersion: true and showPatchesApplied: true
# but the patches silently fail on 2.1.89. These should PASS once fixed.
# ============================================================
S=$(new_session "pai")
start_claude "$S"

if ! wait_for_claude_ready "$S" 15; then
  fail "patches-applied-indication: startup" "timed out"
  kill_session "$S"
  summary
  exit $?
fi

if tweakcc_enabled "misc.showTweakccVersion"; then
  assert_present "$S" "+ tweakcc v" "patches-applied-indication: tweakcc version in header"
else
  skip "patches-applied-indication: tweakcc version" "showTweakccVersion not enabled"
fi

if tweakcc_enabled "misc.showPatchesApplied"; then
  assert_present "$S" "tweakcc patches are applied" "patches-applied-indication: patches list shown"
else
  skip "patches-applied-indication: patches list" "showPatchesApplied not enabled"
fi

# ============================================================
# hide-startup-clawd — regression check
# Config has hideStartupClawd: true but patch silently fails on 2.1.89.
# ============================================================
if tweakcc_enabled "misc.hideStartupClawd"; then
  assert_absent "$S" "▛███▜" "hideStartupClawd: clawd ASCII art suppressed"
else
  skip "hideStartupClawd" "misc.hideStartupClawd not enabled in config"
fi

# ============================================================
# enableConversationTitle — version-gated to CC < 2.0.64.
# On 2.1.89+ the patch silently skips; /title returning "Unknown skill"
# is expected, not a regression.
# ============================================================
if tweakcc_enabled "misc.enableConversationTitle"; then
  if ! cc_version_lt "2.0.64"; then
    skip "conversation-title" \
      "patch is version-gated to CC < 2.0.64; running $(_cc_version)"
  else
    send "$S" "/title"
    sleep 1
    assert_absent "$S" "Unknown skill: title" "conversation-title: /title skill registered"
  fi
else
  skip "conversation-title" "misc.enableConversationTitle not enabled"
fi

quit_claude "$S"
kill_session "$S"

summary

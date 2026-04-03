#!/usr/bin/env bash
# No-API tests for patches with observable startup/UI effects
# that don't require a model response.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

section "No-API Extra"

# ============================================================
# agentsMd — startup in a directory that has AGENTS.md but
# no CLAUDE.md.  With the patch, claude should load AGENTS.md
# as project instructions.  Without the patch (or if it fails)
# claude still starts fine but ignores the file.
# This test only verifies the patch doesn't crash on startup;
# content verification requires an API call (see 08_api_quick.sh).
# ============================================================
if tweakcc_enabled "misc.enableModelCustomizations" || true; then
  # Always run — agentsMd is gated by claudeMdAltNames being non-empty
  AGENTS_DIR=$(mktemp -d)
  trap "rm -rf '$AGENTS_DIR'" EXIT

  MARKER="AGENTSMD_MARKER_$$"
  echo "# Test project — $MARKER" > "$AGENTS_DIR/AGENTS.md"

  S=$(new_session "agents")
  tmux send-keys -t "$S" "cd '$AGENTS_DIR' && claude" Enter

  if ! wait_for_claude_ready "$S" 15; then
    fail "agentsMd: startup in AGENTS.md dir" "timed out"
  else
    pass "agentsMd: claude starts in dir with AGENTS.md (no CLAUDE.md)"
  fi

  quit_claude "$S"
  kill_session "$S"
fi

# ============================================================
# growthBookAntParity — launch with CLAUDE_INTERNAL_FC_OVERRIDES
# env var set.  With the patch applied the env var is parsed and
# used as GrowthBook feature overrides.  Without the patch the
# env var is silently ignored.  Either way claude must start
# without crashing.
# ============================================================
if tweakcc_enabled "antParity.enableGrowthBookOverrides"; then
  S=$(new_session "gbap")
  start_claude "$S" "CLAUDE_INTERNAL_FC_OVERRIDES={\"test_flag\":true}"

  if ! wait_for_claude_ready "$S" 15; then
    fail "growthBookAntParity: startup with FC_OVERRIDES env var" "timed out"
  else
    pass "growthBookAntParity: claude starts with CLAUDE_INTERNAL_FC_OVERRIDES set"
  fi

  quit_claude "$S"
  kill_session "$S"
else
  skip "growthBookAntParity" "antParity.enableGrowthBookOverrides not enabled"
fi

# ============================================================
# worktreeMode — the patch enables the EnterWorktree agent tool
# by bypassing its GrowthBook flag.  The tool itself only fires
# during an API session, but we can verify the patch doesn't
# register a broken slash command (there is no /worktree command;
# this is an agent tool).  Just verify startup is clean.
# ============================================================
if tweakcc_enabled "misc.enableWorktreeMode"; then
  S=$(new_session "wt")
  start_claude "$S"

  if ! wait_for_claude_ready "$S" 15; then
    fail "worktreeMode: startup check" "timed out"
  else
    pass "worktreeMode: claude starts without crash (tool gate patched)"
  fi

  quit_claude "$S"
  kill_session "$S"
else
  skip "worktreeMode" "misc.enableWorktreeMode not enabled"
fi

# ============================================================
# sessionMemory — the patch bypasses both the extraction gate
# (tengu_session_memory) and the past-sessions gate
# (tengu_coral_fern).  Startup should succeed; actual extraction
# only fires when token thresholds are exceeded (hard to verify
# in a quick test, covered by note below).
# ============================================================
if tweakcc_enabled "misc.enableSessionMemory"; then
  S=$(new_session "sm")
  start_claude "$S"

  if ! wait_for_claude_ready "$S" 15; then
    fail "sessionMemory: startup check" "timed out"
  else
    pass "sessionMemory: claude starts (extraction + coral_fern gates patched)"
  fi

  quit_claude "$S"
  kill_session "$S"
else
  skip "sessionMemory" "misc.enableSessionMemory not enabled"
fi

# ============================================================
# reactiveCompact — patch replaces a stub block with a full
# implementation.  No UI effect at startup; the actual compact
# only fires when context overflows (10K+ tokens).
# Just verify startup is clean.
# ============================================================
if tweakcc_enabled "antParity.enableReactiveCompact"; then
  S=$(new_session "rc")
  start_claude "$S"

  if ! wait_for_claude_ready "$S" 15; then
    fail "reactiveCompact: startup check" "timed out"
  else
    pass "reactiveCompact: claude starts (reactive compact stub replaced)"
  fi

  quit_claude "$S"
  kill_session "$S"
else
  skip "reactiveCompact" "antParity.enableReactiveCompact not enabled"
fi

summary

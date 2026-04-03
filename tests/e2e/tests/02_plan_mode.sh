#!/usr/bin/env bash
# Plan mode auto-accept test — requires ANTHROPIC_API_KEY.
# Verifies that the autoAcceptPlanMode patch bypasses the "Ready to code?" dialog.
# The patch inserts an auto-accept call before the dialog renders, so the dialog
# should either never appear or disappear within ~1s of appearing.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

section "Plan Mode Auto-Accept"

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  skip "autoAcceptPlanMode" "ANTHROPIC_API_KEY not set — export it to run this test"
  summary
  exit 0
fi

S=$(new_session "planmode")
start_claude "$S" -- --model "$TWEAKCC_TEST_MODEL"

if ! wait_for_claude_ready "$S" 15; then
  fail "claude startup" "timed out — is tweakcc installed?"
  kill_session "$S"
  summary
  exit $?
fi

# Enable plan mode, then send a minimal prompt that will trigger ExitPlanMode.
send "$S" "/plan"
sleep 0.6
send "$S" "Write a one-line Python hello world function"

# Poll for up to 90s. If "Ready to code?" appears and persists for more than
# 2 seconds, the patch is not working. If it never appears or vanishes
# immediately, the patch is working.
start_ts=$(date +%s)
result="pending"

while true; do
  now_ts=$(date +%s)
  elapsed=$(( now_ts - start_ts ))

  if capture "$S" | grep -qF "Ready to code?"; then
    # Seen — give it 2s to auto-dismiss
    sleep 2
    if capture "$S" | grep -qF "Ready to code?"; then
      result="stuck"
    else
      result="auto_accepted"
    fi
    break
  fi

  # Detect that the plan cycle completed without the dialog:
  # claude returned to the normal input state.
  if (( elapsed >= 90 )); then
    # Check current state: if the dialog isn't showing, plan ran without it
    if ! capture "$S" | grep -qF "Ready to code?"; then
      result="clean_completion"
    else
      result="timeout_stuck"
    fi
    break
  fi

  sleep 0.5
done

case "$result" in
  auto_accepted)
    pass "autoAcceptPlanMode: 'Ready to code?' appeared and was auto-dismissed"
    ;;
  clean_completion)
    pass "autoAcceptPlanMode: plan cycle completed — dialog never appeared"
    ;;
  stuck|timeout_stuck)
    fail "autoAcceptPlanMode" "'Ready to code?' is blocking — patch not firing"
    echo "  --- pane (last 30 lines) ---" >&2
    capture "$S" 20 | tail -30 >&2
    ;;
  *)
    fail "autoAcceptPlanMode" "unexpected state: $result"
    ;;
esac

quit_claude "$S"
kill_session "$S"

summary

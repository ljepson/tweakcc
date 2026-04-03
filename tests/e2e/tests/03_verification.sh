#!/usr/bin/env bash
# Verification agent test — requires ANTHROPIC_API_KEY.
# Verifies that the verificationAgent patch auto-spawns a verifier sub-agent
# after TodoWrite completes 3+ todos.
#
# Trigger conditions (from patch source):
#   - Not already in a sub-agent context
#   - todos.every(t => t.status === "completed")
#   - todos.length >= 3
#   - No todo content matches /verif/i
#
# The spawned verifier outputs a PASS / FAIL / PARTIAL verdict.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

section "Verification Agent Auto-Launch"

if ! claude_authenticated; then
  skip "verificationAgent" "not authenticated (set ANTHROPIC_API_KEY or run 'claude auth login')"
  summary
  exit 0
fi

S=$(new_session "verif")
start_claude "$S" -- --model "$TWEAKCC_TEST_MODEL"

if ! wait_for_claude_ready "$S" 15; then
  fail "claude startup" "timed out — is tweakcc installed?"
  kill_session "$S"
  summary
  exit $?
fi

# Prompt that reliably triggers TodoWrite with 3+ completed todos.
# Deliberately avoids the word "verif" in any task descriptions.
send "$S" "Use TodoWrite to create exactly 3 tasks: (1) add 1+1, (2) add 2+2, (3) add 3+3. Then immediately mark all three as completed using TodoWrite."

# Wait for the todos to be marked complete (parent turn finishes).
# Then wait for the verification verdict. The verifier runs in the background
# (run_in_background: true) and outputs PASS, FAIL, or PARTIAL.
# Total budget: 120s for parent turn + verifier.
if wait_for "$S" "PASS" 120 || wait_for "$S" "FAIL" 5 || wait_for "$S" "PARTIAL" 5; then
  pass "verificationAgent: verifier spawned and issued a verdict"
else
  # Fallback: search scrollback for any verifier evidence
  if capture_history "$S" | grep -qi "verification\|verif"; then
    pass "verificationAgent: verifier output detected in scrollback (no explicit PASS/FAIL/PARTIAL)"
  else
    fail "verificationAgent" "no verifier verdict or output after 120s"
    echo "  --- last 40 lines of history ---" >&2
    capture_history "$S" 100 | tail -40 >&2
    echo "  ---" >&2
  fi
fi

quit_claude "$S"
kill_session "$S"

summary

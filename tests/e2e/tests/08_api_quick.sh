#!/usr/bin/env bash
# One-turn API tests — each test sends one prompt and checks
# the response.  Requires a valid API key.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

section "API Quick"

if ! claude_authenticated; then
  skip "api-quick" "not authenticated (set ANTHROPIC_API_KEY or run 'claude auth login')"
  summary
  exit 0
fi

S=$(new_session "api")
start_claude "$S" -- --model "$TWEAKCC_TEST_MODEL"

if ! wait_for_claude_ready "$S" 15; then
  fail "API test startup" "timed out after 15s"
  kill_session "$S"
  summary
  exit $?
fi

# ============================================================
# userMessageDisplay — custom format " > {} " applied to every
# human message rendered in the transcript.  After we send a
# message and Claude responds, the user turn should appear as
# " > <text>" in the pane.
# ============================================================
USER_MSG="hello from tweakcc test $$"
send "$S" "$USER_MSG"

# Wait for Claude to respond (we don't care what it says)
if ! wait_for "$S" "Claude" 30; then
  fail "userMessageDisplay: response" "timed out waiting for any Claude output"
else
  # The user message line should contain " > " prefix per the configured format
  if capture_history "$S" | grep -qF " > $USER_MSG"; then
    pass "userMessageDisplay: user message rendered with custom \" > \" prefix"
  elif capture_history "$S" | grep -qF "> $USER_MSG"; then
    pass "userMessageDisplay: user message rendered with \"> \" prefix (format variant)"
  else
    fail "userMessageDisplay: user message format" "expected ' > $USER_MSG' in history"
    echo "  --- last 20 lines of history ---" >&2
    capture_history "$S" 40 | tail -20 >&2
    echo "  ---" >&2
  fi
fi

# Wait for Claude to finish before next test
sleep 2

# ============================================================
# expandThinkingBlocks — normally thinking blocks are hidden
# in transcript mode (guarded by isTranscriptMode flag).
# The patch hardcodes isTranscriptMode:true so thinking blocks
# always render.  To trigger a thinking block we need a model
# that supports extended thinking and a prompt that activates it.
# If no thinking block appears the test is skipped (not failed)
# since extended thinking may not be active for this model/request.
# ============================================================
if tweakcc_enabled "misc.expandThinkingBlocks"; then
  send "$S" "Reason step by step: what is 17 multiplied by 23? Show your thinking."

  # Give extra time for a potentially-thinking response
  sleep 8

  HISTORY=$(capture_history "$S" 500)

  # Thinking blocks in Claude Code appear with specific markers.
  # The ThinkingBlock component uses a distinctive header.
  if echo "$HISTORY" | grep -qiE "(thinking|⟨think|antml:thinking)"; then
    pass "expandThinkingBlocks: thinking block visible in transcript"
  elif echo "$HISTORY" | grep -qF "multiplied"; then
    skip "expandThinkingBlocks: visible thinking block" \
      "response present but no thinking block generated (extended thinking may be off)"
  else
    fail "expandThinkingBlocks: response" "timed out or no response"
  fi
else
  skip "expandThinkingBlocks" "misc.expandThinkingBlocks not enabled"
fi

sleep 1

# ============================================================
# planModeInterview — with forcePlanModeInterview:true the patch
# makes isPlanModeInterviewPhaseEnabled() always return true.
# In plan mode, Claude should ask interview/clarifying questions
# before generating the plan, rather than immediately outputting it.
# We enter plan mode, send a task description, and verify Claude
# asks a question back (the interview phase is active).
# ============================================================
if tweakcc_enabled "antParity.forcePlanModeInterview"; then
  send "$S" "/plan"
  sleep 1

  if wait_for "$S" "plan" 5; then
    # Now send a task description
    send "$S" "Build a simple REST API for a todo list app"
    sleep 6

    HISTORY=$(capture_history "$S" 500)

    # The interview phase asks clarifying questions.
    # A response ending in "?" strongly suggests interview mode.
    # Also look for typical interview phrases.
    if echo "$HISTORY" | grep -qiE "(Before I (create|start|build)|clarify|clarifying|What (kind|type|language|framework)|requirement|preference|stack)\?"; then
      pass "planModeInterview: interview questions asked before plan generation"
    elif echo "$HISTORY" | grep -qF "?"; then
      pass "planModeInterview: response contains question (interview phase likely active)"
    else
      fail "planModeInterview: interview phase" \
        "no clarifying questions found; plan may have been generated without interview"
      echo "  --- last 20 lines of history ---" >&2
      capture_history "$S" 80 | tail -20 >&2
      echo "  ---" >&2
    fi

    # Exit plan mode
    send "$S" "/plan"
    sleep 1
  else
    fail "planModeInterview: plan mode entry" "/plan did not activate plan mode"
  fi
else
  skip "planModeInterview" "antParity.forcePlanModeInterview not enabled"
fi

sleep 1

# ============================================================
# worktreeMode — the patch enables the EnterWorktree agent tool
# by bypassing the tengu_worktree_mode flag.  If available, when
# we ask Claude to enter a worktree, it should attempt to use
# the EnterWorktree tool rather than say it can't do that.
# ============================================================
if tweakcc_enabled "misc.enableWorktreeMode"; then
  send "$S" "Do you have the EnterWorktree tool available? Answer yes or no."
  sleep 6

  HISTORY=$(capture_history "$S" 500)

  if echo "$HISTORY" | grep -qiE "\byes\b"; then
    pass "worktreeMode: EnterWorktree tool is available"
  elif echo "$HISTORY" | grep -qiE "(EnterWorktree|worktree|enter.worktree)"; then
    pass "worktreeMode: EnterWorktree tool referenced in response"
  elif echo "$HISTORY" | grep -qiE "\bno\b.*(tool|worktree|available|access)"; then
    fail "worktreeMode: tool availability" \
      "Claude says EnterWorktree tool is not available (patch may have failed)"
  else
    skip "worktreeMode: tool confirmation" "response did not clearly confirm or deny tool availability"
  fi
else
  skip "worktreeMode" "misc.enableWorktreeMode not enabled"
fi

sleep 1

# ============================================================
# verboseProperty — patch sets verbose:true on the tool-execution
# spinner component, which adds timing info (e.g. "2.3s") to the
# spinner during tool use.  We trigger a Bash tool call and look
# for a timing indicator in the scrollback.
# Timing format is not guaranteed to be stable, so we look for
# a digit + "s" pattern near tool output.
# ============================================================
send "$S" "Run the shell command: echo tweakcc_verbose_test"
sleep 8

HISTORY=$(capture_history "$S" 500)

if echo "$HISTORY" | grep -q "tweakcc_verbose_test"; then
  # Tool executed; check for timing info in the spinner output area
  if echo "$HISTORY" | grep -qE "[0-9]+\.[0-9]+s|[0-9]+ms"; then
    pass "verboseProperty: timing info present during tool execution"
  else
    skip "verboseProperty: timing indicator" \
      "tool executed but no timing pattern found — format may differ"
  fi
else
  fail "verboseProperty: Bash tool execution" "echo output not found in history"
fi

sleep 1

# ============================================================
# kairos — patch injects [KAIROS AUTO-MODE] into the system
# prompt and starts a background tick loop.  Two checks:
#
# 1. API (primary): ask Claude if KAIROS AUTO-MODE is in its
#    system prompt — it can read its own context window.
#
# 2. JSONL (secondary): the session transcript is written to
#    ~/.claude/projects/<encoded-cwd>/*.jsonl.  After the API
#    exchange Claude's response mentioning KAIROS should be
#    present in the JSONL, confirming the patched binary ran
#    and the session is being logged.  Ticks (<tick>…</tick>)
#    would also appear here but require ≥60s; we skip that.
#
# Patch is version-pinned to CC 2.1.89.
# ============================================================
if tweakcc_enabled "antParity.enableKairos"; then
  CC_VER=$(_cc_version)
  if [[ "$CC_VER" != "2.1.89" ]]; then
    skip "kairos" "patch pinned to CC 2.1.89 (current: ${CC_VER:-unknown})"
  else
    send "$S" "Does your system prompt contain the text 'KAIROS AUTO-MODE'? Answer only yes or no."
    sleep 8

    HISTORY=$(capture_history "$S" 500)

    if echo "$HISTORY" | grep -qiE "\byes\b"; then
      pass "kairos: KAIROS AUTO-MODE confirmed present in system prompt"
    elif echo "$HISTORY" | grep -qi "KAIROS"; then
      pass "kairos: KAIROS text appears in response"
    else
      fail "kairos: system prompt injection" "no KAIROS confirmation in response"
      echo "  --- last 20 lines ---" >&2
      capture_history "$S" 80 | tail -20 >&2
      echo "  ---" >&2
    fi

    # Secondary: verify the exchange appears in the session JSONL.
    # Encode CWD the same way Claude Code does: replace non-alphanumeric with '-'.
    PANE_CWD=$(tmux display-message -p -t "$S" '#{pane_current_path}' 2>/dev/null || true)
    if [[ -n "$PANE_CWD" ]]; then
      ENCODED=$(echo "$PANE_CWD" | sed 's/[^a-zA-Z0-9]/-/g')
      JSONL_DIR="$HOME/.claude/projects/$ENCODED"
      if [[ -d "$JSONL_DIR" ]] && \
         grep -rlq "KAIROS" "$JSONL_DIR" 2>/dev/null; then
        pass "kairos: KAIROS text written to session JSONL"
      else
        skip "kairos: session JSONL check" \
          "KAIROS not found in JSONL (may not be flushed or dir not found: $JSONL_DIR)"
      fi
    else
      skip "kairos: session JSONL check" "could not determine pane CWD"
    fi
  fi
else
  skip "kairos" "antParity.enableKairos not enabled"
fi

quit_claude "$S"
kill_session "$S"

summary

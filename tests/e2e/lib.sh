#!/usr/bin/env bash
# tweakcc e2e test library — tmux-based TTY automation

TERM_COLS=220
TERM_ROWS=50
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
_ACTIVE_SESSIONS=()

_R='\033[0;31m'
_G='\033[0;32m'
_Y='\033[1;33m'
_C='\033[0;36m'
_B='\033[1m'
_N='\033[0m'

_cleanup() {
  for s in "${_ACTIVE_SESSIONS[@]+"${_ACTIVE_SESSIONS[@]}"}"; do
    tmux kill-session -t "$s" 2>/dev/null || true
  done
}
trap _cleanup EXIT

# Create a new detached tmux session. Prints the session name.
new_session() {
  local name="e2e-$$-${1:-s}"
  _ACTIVE_SESSIONS+=("$name")
  tmux new-session -d -s "$name" -x "$TERM_COLS" -y "$TERM_ROWS"
  echo "$name"
}

# Kill a session and remove it from the tracking list.
kill_session() {
  tmux kill-session -t "$1" 2>/dev/null || true
  local filtered=()
  for s in "${_ACTIVE_SESSIONS[@]+"${_ACTIVE_SESSIONS[@]}"}"; do
    [[ "$s" != "$1" ]] && filtered+=("$s")
  done
  _ACTIVE_SESSIONS=("${filtered[@]+"${filtered[@]}"}")
}

# Send text + Enter.
send() { tmux send-keys -t "$1" "$2" Enter; }

# Send a special key (C-c, Escape, Up, etc.) without Enter.
send_key() { tmux send-keys -t "$1" "$2"; }

# Capture the current visible pane content (no scrollback).
# This is what you want for TUI apps that render in-place (like Ink).
capture() {
  local session="$1"
  tmux capture-pane -t "$session" -p
}

# Capture current screen + N lines of scrollback history.
# Use this when searching for output that may have scrolled off screen.
capture_history() {
  local session="$1" lines="${2:-500}"
  tmux capture-pane -t "$session" -p -S "-$lines"
}

# Wait for a fixed string to appear in the pane. Returns 0/1.
# Usage: wait_for SESSION PATTERN [TIMEOUT_SECS=30]
wait_for() {
  local session="$1" pattern="$2" timeout="${3:-30}"
  local start now
  start=$(date +%s)
  while true; do
    if capture "$session" | grep -qF "$pattern"; then
      return 0
    fi
    now=$(date +%s)
    (( now - start >= timeout )) && return 1
    sleep 0.2
  done
}

# Wait for a fixed string to disappear. Returns 0 when gone, 1 on timeout.
wait_gone() {
  local session="$1" pattern="$2" timeout="${3:-10}"
  local start now
  start=$(date +%s)
  while true; do
    if ! capture "$session" | grep -qF "$pattern"; then
      return 0
    fi
    now=$(date +%s)
    (( now - start >= timeout )) && return 1
    sleep 0.2
  done
}

# ============================================================

pass() { echo -e "${_G}PASS${_N}  $1"; (( PASS_COUNT++ )); }

fail() {
  echo -e "${_R}FAIL${_N}  $1${2:+  → $2}"
  (( FAIL_COUNT++ ))
  return 0
}

skip() { echo -e "${_Y}SKIP${_N}  $1${2:+  (${2})}"; (( SKIP_COUNT++ )); }

assert_present() {
  local session="$1" pattern="$2" msg="$3"
  if capture "$session" | grep -qF "$pattern"; then
    pass "$msg"
  else
    fail "$msg" "pattern not found: '$pattern'"
    echo "  --- current pane ---" >&2
    capture "$session" >&2
    echo "  ---" >&2
  fi
}

assert_absent() {
  local session="$1" pattern="$2" msg="$3"
  if ! capture "$session" | grep -qF "$pattern"; then
    pass "$msg"
  else
    fail "$msg" "should not be present: '$pattern'"
  fi
}

# Like assert_present but searches scrollback history too (for responses that scrolled).
assert_present_history() {
  local session="$1" pattern="$2" msg="$3" lines="${4:-500}"
  if capture_history "$session" "$lines" | grep -qF "$pattern"; then
    pass "$msg"
  else
    fail "$msg" "pattern not found in scrollback: '$pattern'"
    echo "  --- last 30 lines of history ---" >&2
    capture_history "$session" 50 | tail -30 >&2
    echo "  ---" >&2
  fi
}

section() {
  echo ""
  echo -e "${_C}${_B}=== $* ===${_N}"
}

# Print final counts. Exits 0 if all pass, 1 if any fail.
summary() {
  echo ""
  echo -e "${_B}Results:${_N}  ${_G}${PASS_COUNT} passed${_N}  ${_R}${FAIL_COUNT} failed${_N}  ${_Y}${SKIP_COUNT} skipped${_N}"
  (( FAIL_COUNT == 0 ))
}

# Start claude in the given session with optional env vars prefixed before the command.
# Usage: start_claude SESSION [KEY=VAL ...] [-- extra-claude-flags]
start_claude() {
  local session="$1"; shift
  local env_prefix="" flags=""
  while (( $# )); do
    case "$1" in
      --) shift; flags="$*"; break ;;
      *=*) env_prefix+=" $1"; shift ;;
      *) flags+=" $1"; shift ;;
    esac
  done
  local cmd="claude${flags}"
  [[ -n "$env_prefix" ]] && cmd="env${env_prefix} claude${flags}"
  tmux send-keys -t "$session" "$cmd" Enter
}

# Quit claude (best-effort).
quit_claude() {
  local session="$1"
  send_key "$session" C-c
  sleep 0.4
  send "$session" "/quit" 2>/dev/null || true
  sleep 0.3
}

# Wait for claude's TUI to render. Uses "Claude Code" which always appears
# in the startup header regardless of patch state.
# Returns 0 on success, 1 on timeout.
wait_for_claude_ready() {
  local session="$1" timeout="${2:-15}"
  wait_for "$session" "Claude Code" "$timeout"
}

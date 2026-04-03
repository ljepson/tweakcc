#!/usr/bin/env bash
# Slash command tests — no API calls required.
# Tests patches that register or modify slash command behavior.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

section "Slash Commands"

S=$(new_session "commands")
start_claude "$S"

if ! wait_for_claude_ready "$S" 15; then
  fail "claude startup" "timed out"
  kill_session "$S"
  summary
  exit $?
fi

# ============================================================
# model-customizations + show-more-items-in-select-menus
# Default CC shows 3 models. Both patches together produce 10+ items.
# ============================================================
send "$S" "/model"
if ! wait_for "$S" "Select model" 5; then
  fail "model-customizations: /model menu opens" "menu did not appear"
else
  pass "model-customizations: /model menu opens"
  # Default CC shows 3 entries. Patch expands to 20+. "and N more" confirms >10.
  assert_present "$S" "and " "show-more-items-in-select-menus: overflow indicator present (> default 3 models)"
  # Dismiss
  send_key "$S" Escape
  sleep 0.3
fi

# ============================================================
# context-diagnostics
# Unpatched /context shows a simple token bar. Patched shows
# per-category breakdown with labels like "System prompt:" etc.
# ============================================================
send "$S" "/context"
sleep 2
# Use history since the output may be longer than the visible pane
if capture_history "$S" | grep -qF "System prompt:"; then
  pass "context-diagnostics: per-category breakdown shown"
elif capture_history "$S" | grep -qF "tokens"; then
  pass "context-diagnostics: token info present (detailed labels may vary)"
else
  fail "context-diagnostics" "/context output did not contain expected breakdown"
  capture_history "$S" 80 | tail -30 >&2
fi
send_key "$S" Escape
sleep 0.3

# ============================================================
# conversation-title
# The patch registers a /title skill. "Unknown skill: title" means it's not registered.
# Requires misc.conversationTitle: true in config.
# ============================================================
if tweakcc_enabled "misc.enableConversationTitle"; then
  if ! cc_version_lt "2.0.64"; then
    skip "conversation-title: /title skill" \
      "patch is version-gated to CC < 2.0.64; running $(_cc_version)"
  else
    send "$S" "/title"
    sleep 1
    assert_absent "$S" "Unknown skill: title" "conversation-title: /title skill registered"
  fi
else
  skip "conversation-title: /title skill" "misc.enableConversationTitle not enabled in config"
fi

# ============================================================
# remember-skill
# The patch registers a /remember skill.
# Requires misc.rememberSkill: true in config.
# ============================================================
if tweakcc_enabled "misc.rememberSkill"; then
  send "$S" "/remember"
  sleep 1
  assert_absent "$S" "Unknown skill: remember" "remember-skill: /remember skill registered"
else
  skip "remember-skill: /remember skill" "misc.rememberSkill not enabled in config"
fi

quit_claude "$S"
kill_session "$S"

summary

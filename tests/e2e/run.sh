#!/usr/bin/env bash
# tweakcc e2e test runner
# Usage: ./run.sh [test-name-prefix]
# Examples:
#   ./run.sh             # run all tests
#   ./run.sh 01          # run startup tests only
#   ./run.sh 02          # run plan mode test only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="$SCRIPT_DIR/tests"
FILTER="${1:-}"

if ! command -v tmux &>/dev/null; then
  echo "Error: tmux is required" >&2
  exit 1
fi

if ! command -v claude &>/dev/null; then
  echo "Error: claude not found in PATH" >&2
  exit 1
fi

echo "tweakcc e2e tests"
echo "claude: $(command -v claude)  version: $(claude --version 2>/dev/null | head -1 || echo unknown)"
echo "tmux: $(tmux -V)"
echo ""

overall_pass=0
overall_fail=0
declare -a failed_files=()

for test_file in "$TESTS_DIR"/[0-9]*.sh; do
  [[ -f "$test_file" ]] || continue
  name="$(basename "$test_file")"
  [[ -n "$FILTER" && "$name" != ${FILTER}* ]] && continue

  echo -e "\033[1mRunning: ${name}\033[0m"
  if bash "$test_file"; then
    (( overall_pass++ ))
  else
    (( overall_fail++ ))
    failed_files+=("$name")
  fi
done

echo ""
echo "=============================="
echo -e "\033[1mSuite results:\033[0m  ${overall_pass} files passed  ${overall_fail} files failed"
if (( ${#failed_files[@]} > 0 )); then
  echo "Failed:"
  for f in "${failed_files[@]}"; do
    echo "  - $f"
  done
fi

(( overall_fail == 0 ))

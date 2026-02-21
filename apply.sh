#!/bin/sh
set -eu

cd "$(dirname "$0")"

log() {
  printf '[tweakcc] %s\n' "$*"
}

OS="$(uname -s)"
#CLAUDE_BIN="$HOME/.local/bin/claude"
CLAUDE_BIN="$HOME/.local/share/claude/versions/2.1.37"
DOTFILES_DIR="$HOME/Projects/dotfiles"

remove_immutable() {
  case "$OS" in
  Darwin)
    chflags nouchg "$CLAUDE_BIN" 2>/dev/null || true
    ;;
  Linux)
    if ! chattr -i "$CLAUDE_BIN" 2>/dev/null; then
      sudo chattr -i "$CLAUDE_BIN" 2>/dev/null || true
    fi
    ;;
  esac
}

restore_immutable() {
  case "$OS" in
  Darwin)
    chflags uchg "$CLAUDE_BIN" 2>/dev/null || true
    ;;
  Linux)
    if ! chattr +i "$CLAUDE_BIN" 2>/dev/null; then
      sudo chattr +i "$CLAUDE_BIN" 2>/dev/null || true
    fi
    ;;
  esac
}

cleanup() {
  log "Cleaning up..."
  restore_immutable
  watchman watch "$DOTFILES_DIR" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

log "Pausing watchman..."
watchman watch-del "$DOTFILES_DIR" 2>/dev/null || true

log "Removing immutable flag from claude binary..."
remove_immutable

log "Installing dependencies..."
pnpm install

log "Approving builds (may fail, continuing)..."
pnpm approve-builds 2>/dev/null || true

log "Building..."
pnpm build

log "Restoring patches..."
pnpm start --restore

log "Applying patches..."
pnpm start --apply

log "Done!"

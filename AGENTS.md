# AGENTS.md

This document provides guidelines for agentic coding assistants working in this repository.

## Development Commands

```bash
# Build
pnpm build           # Production build (typecheck + minify)
pnpm build:dev       # Development build (no minification)
pnpm watch           # Watch mode for iterative development

# Testing
pnpm test            # Run all tests once
pnpm test:dev        # Run tests in watch mode
npx vitest run <test-file>     # Run single test file
pnpm run test -- <pattern>     # Run tests matching pattern

# Linting & Formatting
pnpm lint            # Typecheck + ESLint
pnpm format          # Format code with Prettier

# Run CLI
pnpm start           # Run built CLI
node dist/index.mjs  # Alternative run command
```

## Claude Patch Validation Pipeline

Use this pipeline when updating Claude Code versions or changing bundle patches.

```bash
# 1. Typecheck and rebuild dist before using validation scripts.
pnpm build

# 2. Run focused tests for any patches you touched.
npx vitest run src/patches/<patch-name>.test.ts

# 3. Validate against a clean Claude Code install and apply the full config.
ANTHROPIC_API_KEY="$ANTHROPIC_REFLEX_API_KEY" \
  ~/Projects/dotfiles/bin/validate-claude-patches.sh --version 2.1.120

# 4. For latest-version upgrades, run the real reset/apply flow.
~/Projects/dotfiles/bin/reset-claude.sh --latest --apply --force

# 5. If reset/apply succeeds or after resolving conflicts, re-run validation
#    without another reset to verify the currently patched binary.
ANTHROPIC_API_KEY="$ANTHROPIC_REFLEX_API_KEY" \
  ~/Projects/dotfiles/bin/validate-claude-patches.sh --version 2.1.120 --skip-reset
```

Validation expectations:

- `validate-claude-patches.sh` must run smoke tests with `-d`, keep JSON stdout separate from debug stderr, and scan debug logs.
- A passing run should show baseline smoke `PASS`, patched smoke `PASS`, artifact validation `0 failed`, and exit code `0`.
- Debug stderr must not contain `Fast mode unavailable`, `attribution header x-anthropic-billing-header`, or `Tool search disabled`.
- If the validator reports `Not logged in`, pass `ANTHROPIC_API_KEY="$ANTHROPIC_REFLEX_API_KEY"` or restore Claude auth before trusting patch results.
- If `reset-claude.sh --latest --apply --force` stashes local work and then reports conflicts, resolve conflicts, run `pnpm build:dev`, then finish with `TWEAKCC_CC_INSTALLATION_PATH="$HOME/.local/share/claude/versions/<version>" pnpm start --apply`.
- Do not trust ad hoc disposable apply checks as the final signal; use the dotfiles validator as the source of truth.

## Code Style

### Formatting

- **Prettier**: 80 char width, single quotes, 2 spaces, semicolons required
- **No comments**: Do not add comments unless explicitly requested
- **Section dividers**: Use `// ======` lines for major code sections

### Imports

```typescript
// Group imports in this order:
import fs from 'node:fs/promises'; // Node.js built-ins (use node: prefix)
import path from 'node:path';
import chalk from 'chalk'; // Third-party libraries
import ink from 'ink';
import { getConfig } from '@/config'; // Internal imports (use @/ alias)
import { PatchConfig } from '@/types';
```

### TypeScript

- **Strict mode** enabled in tsconfig.json
- **Avoid `any`**: Use `unknown` with type guards or `as unknown as Type` for assertions
- **Interfaces** for complex objects, types for simple unions
- **Custom errors**: Extend `Error` class with `name` property

```typescript
export class CustomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomError';
  }
}
```

### Naming Conventions

- **Files**: camelCase for logic (`config.ts`), PascalCase for React components (`MainView.tsx`)
- **Functions**: camelCase (`getConfig`, `detectInstallation`)
- **Constants**: UPPER_SNAKE_CASE (`CONFIG_DIR`, `DEFAULT_CONFIG`)
- **Components**: PascalCase with descriptive names (`ThinkingVerbsView`)
- **Interfaces**: PascalCase, descriptive (`StringsPrompt`, `MarkdownPrompt`)

### Error Handling

```typescript
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  debug('Error occurred:', error);
  return null; // Graceful fallback
}
```

### React Patterns

- Use hooks: `useState`, `useEffect`, `useCallback`
- Context API for state management
- Ink components: `Box`, `Text`, `Newline`
- Explicit prop types with interfaces

### Writing Patches

- **Identifier matching**: Use `[$\\w]+` instead of `\\w+` (includes `$` for React refs)
- **Word boundaries**: Use `,` `;` `}` `{` literal characters at regex start instead of `\\b` for performance
- **Avoid `\\b`**: Performance issue in V8, use literal alternatives

### Testing

```typescript
// Use Vitest globals
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('functionName', () => {
  beforeEach(() => {
    vi.mock('some-module');
  });

  it('should do something', () => {
    expect(result).toBe(expected);
  });
});
```

- Test files in `src/tests/*.test.ts` and `src/patches/*.test.ts`
- Mock dependencies with `vi.mock()`
- Test edge cases and error conditions

### CLI Patterns

- Use `ink` for CLI rendering
- Use `chalk` for terminal colors
- Use `commander` for CLI argument parsing
- Add shebang to index.tsx for executable support

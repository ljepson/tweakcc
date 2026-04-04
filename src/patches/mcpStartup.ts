// Please see the note about writing patches in ./index
//
// MCP Startup Optimization Patch
// Based on: https://cuipengfei.is-a.dev/blog/2026/01/24/claude-code-mcp-startup-optimization/
//
// This patch modifies Claude Code's MCP connection behavior:
// - MCP_CONNECTION_NONBLOCKING: Don't block startup waiting for all MCPs to connect
// - MCP_SERVER_CONNECTION_BATCH_SIZE: Connect more servers in parallel (default: 3)

import { showDiff, LocationResult } from './index';

/**
 * Find the MCP non-blocking check location.
 *
 * Pattern: !someVar(process.env.MCP_CONNECTION_NONBLOCKING)
 * This check determines whether to block on MCP connections.
 * Replacing it with "false" forces non-blocking mode.
 */
const getNonBlockingCheckLocation = (
  oldFile: string
): LocationResult | null => {
  const patterns = [
    /![$\w]+\(process\.env\.MCP_CONNECTION_NONBLOCKING\)/,
    /([$\w]+)=[$\w]+\(process\.env\.MCP_CONNECTION_NONBLOCKING\)/,
  ];

  for (const pattern of patterns) {
    const match = oldFile.match(pattern);
    if (!match || match.index === undefined) {
      continue;
    }

    if (pattern === patterns[0]) {
      return {
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      };
    }

    const assignedVar = match[1];
    const startIndex = match.index + assignedVar.length + 1;
    return {
      startIndex,
      endIndex: match.index + match[0].length,
    };
  }

  return null;
};

/**
 * Find the MCP batch size default value location.
 *
 * The default value appears in two known forms across CC versions:
 *   v2.1.91-: parseInt(process.env.MCP_SERVER_CONNECTION_BATCH_SIZE||"",10)||3
 *   v2.1.92+: ...BATCH_SIZE||"",10);return H>0?H:3
 * We want to replace the default "3" with a higher value.
 */
const getBatchSizeLocation = (oldFile: string): LocationResult | null => {
  const patterns = [
    // v2.1.92+: ternary fallback — ...BATCH_SIZE||"",10);return VAR>0?VAR:3
    /MCP_SERVER_CONNECTION_BATCH_SIZE\|\|"",10\);return [$\w]+>0\?[$\w]+:(\d+)/,
    // v2.1.91-: logical-or fallback — ...BATCH_SIZE||"",10)||3
    /MCP_SERVER_CONNECTION_BATCH_SIZE\|\|"",10\)\|\|(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = oldFile.match(pattern);
    if (!match || match.index === undefined) {
      continue;
    }

    // Find the position of the default number (the captured group)
    const fullMatch = match[0];
    const defaultValue = match[1];
    const defaultValueOffset = fullMatch.lastIndexOf(defaultValue);

    const startIndex = match.index + defaultValueOffset;
    const endIndex = startIndex + defaultValue.length;

    return {
      startIndex,
      endIndex,
    };
  }

  console.error(
    'patch: mcpStartup: failed to find MCP_SERVER_CONNECTION_BATCH_SIZE default'
  );
  return null;
};

/**
 * Apply non-blocking MCP startup by replacing the blocking check with "false".
 */
export const writeMcpNonBlocking = (oldFile: string): string | null => {
  const location = getNonBlockingCheckLocation(oldFile);
  if (!location) {
    // MCP_CONNECTION_NONBLOCKING was removed in CC 2.1.87+ (startup is
    // already non-blocking by default). Skip silently.
    return oldFile;
  }

  // Replace the check/value with "true" to force non-blocking mode.
  const newValue = 'true';
  const newFile =
    oldFile.slice(0, location.startIndex) +
    newValue +
    oldFile.slice(location.endIndex);

  showDiff(oldFile, newFile, newValue, location.startIndex, location.endIndex);
  return newFile;
};

/**
 * Apply MCP batch size optimization by replacing the default value.
 */
export const writeMcpBatchSize = (
  oldFile: string,
  batchSize: number
): string | null => {
  const location = getBatchSizeLocation(oldFile);
  if (!location) {
    return null;
  }

  const newValue = String(batchSize);
  const newFile =
    oldFile.slice(0, location.startIndex) +
    newValue +
    oldFile.slice(location.endIndex);

  showDiff(oldFile, newFile, newValue, location.startIndex, location.endIndex);
  return newFile;
};

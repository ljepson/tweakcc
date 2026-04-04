import { describe, expect, it, vi } from 'vitest';
import { writeMcpBatchSize } from './mcpStartup';

// v2.1.92+ ternary form — extracted from actual cli.js
// function Vd8(){let H=parseInt(process.env.MCP_SERVER_CONNECTION_BATCH_SIZE||"",10);return H>0?H:3}
const mockTernaryForm =
  'function Vd8(){let H=parseInt(process.env.MCP_SERVER_CONNECTION_BATCH_SIZE||"",10);return H>0?H:3}' +
  'function Mw9(){let H=parseInt(process.env.MCP_REMOTE_SERVER_CONNECTION_BATCH_SIZE||"",10);return H>0?H:20}';

// v2.1.91- logical-OR form
const mockLogicalOrForm =
  'function getBatch(){return parseInt(process.env.MCP_SERVER_CONNECTION_BATCH_SIZE||"",10)||3}' +
  'function other(){return 1}';

// Ternary form with a $-containing identifier
const mockTernaryFormWithDollar =
  'function $d8(){let $H=parseInt(process.env.MCP_SERVER_CONNECTION_BATCH_SIZE||"",10);return $H>0?$H:3}' +
  'function next(){return 0}';

describe('writeMcpBatchSize', () => {
  it('patches the ternary form (v2.1.92+)', () => {
    const result = writeMcpBatchSize(mockTernaryForm, 10);
    expect(result).not.toBeNull();
    expect(result).toContain(':10}');
    expect(result).not.toContain(':3}');
    // Unrelated REMOTE batch size default should be untouched
    expect(result).toContain(':20}');
  });

  it('patches the logical-OR form (v2.1.91-)', () => {
    const result = writeMcpBatchSize(mockLogicalOrForm, 10);
    expect(result).not.toBeNull();
    expect(result).toContain('||"",10)||10');
    expect(result).not.toContain('||"",10)||3');
  });

  it('handles identifiers containing $', () => {
    const result = writeMcpBatchSize(mockTernaryFormWithDollar, 8);
    expect(result).not.toBeNull();
    expect(result).toContain(':8}');
    expect(result).not.toContain(':3}');
  });

  it('is idempotent — applying twice does not corrupt the output', () => {
    const first = writeMcpBatchSize(mockTernaryForm, 10);
    expect(first).not.toBeNull();
    const second = writeMcpBatchSize(first!, 10);
    expect(second).not.toBeNull();
    expect(second).toBe(first);
  });

  it('is idempotent for the logical-OR form', () => {
    const first = writeMcpBatchSize(mockLogicalOrForm, 10);
    expect(first).not.toBeNull();
    const second = writeMcpBatchSize(first!, 10);
    expect(second).not.toBeNull();
    expect(second).toBe(first);
  });

  it('returns null when the pattern is absent', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = writeMcpBatchSize('function unrelated(){return 42}', 10);
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});

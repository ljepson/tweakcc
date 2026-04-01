import { describe, expect, it } from 'vitest';
import { writeThinkerSymbolChars } from './thinkerSymbolChars';

describe('writeThinkerSymbolChars', () => {
  it('replaces the whole ghostty spinner function without corrupting it', () => {
    const input =
      'function ZtH(){if(process.env.TERM==="xterm-ghostty")return["\\xB7","\\u2722","\\u2733","\\u2736","\\u273B","*"];return["\\xB7","\\u2722","*","\\u2736","\\u273B","\\u273D"]}function next(){return 1}';

    const result = writeThinkerSymbolChars(input, ['a', 'b', 'c']);

    expect(result).toBe(
      'function ZtH(){if(process.env.TERM==="xterm-ghostty")return["a","b","c"];return["a","b","c"]}function next(){return 1}'
    );
  });

  it('falls back to replacing standalone symbol arrays when no helper function exists', () => {
    const input =
      'const a=["\\xB7","\\u2722","*","\\u2736","\\u273B","\\u273D"];const b=1;';

    const result = writeThinkerSymbolChars(input, ['x', 'y']);

    expect(result).toBe('const a=["x","y"];const b=1;');
  });
});

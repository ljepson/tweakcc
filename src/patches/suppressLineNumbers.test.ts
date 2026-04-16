import { describe, expect, it } from 'vitest';
import { writeSuppressLineNumbers } from './suppressLineNumbers';

describe('suppressLineNumbers', () => {
  it('adds a separator for the 2.1.112 formatter shape', () => {
    const oldFile =
      'function eR6(H,$,q){let K=H.endsWith("\\r")?H.slice(0,-1):H;if(q)return`${$}\t${K}`;let _=String($);return _.length>=6?`${_}\\u2192${K}`:`${_.padStart(6," ")}\\u2192${K}`}function qC6(H){return H.match(/^\\s*\\d+[\\u2192\\t](.*)$/)?.[1]??H}';

    const result = writeSuppressLineNumbers(oldFile);

    expect(result).not.toBeNull();
    expect(result).toContain(
      'function eR6(H,$,q){let K=H.endsWith("\\r")?H.slice(0,-1):H;return K}function qC6'
    );
    expect(result).not.toContain('return Kfunction qC6');
  });

  it('adds a separator for the compact formatter shape', () => {
    const oldFile =
      'function qx6(H){if(H.length>=3)return`${H}→${K}`;return`${H.padStart(3," ")}→${K}`}function qC6(H){return H}';

    const result = writeSuppressLineNumbers(oldFile);

    expect(result).not.toBeNull();
    expect(result).toContain(
      'function qx6(H){return K;}function qC6(H){return H}'
    );
  });
});

import { describe, expect, it } from 'vitest';

import type { StringsFile } from '../systemPromptSync';
import { recoverStringsFileFromContent } from '../systemPromptRecovery';

describe('systemPromptRecovery', () => {
  it('recovers prompts from current JS content using prior prompt sources', () => {
    const sources: StringsFile[] = [
      {
        version: '1.0.1',
        prompts: [
          {
            id: 'static-prompt',
            name: 'Static Prompt',
            description: 'No identifiers',
            pieces: ['Alpha prompt body'],
            identifiers: [],
            identifierMap: {},
            version: '1.0.1',
          },
          {
            id: 'templated-prompt',
            name: 'Templated Prompt',
            description: 'Has identifiers',
            pieces: ['Before ${', '} after ${', '}.'],
            identifiers: [0, 1],
            identifierMap: {
              '0': 'FIRST_VAR',
              '1': 'SECOND_VAR',
            },
            version: '1.0.1',
          },
        ],
      },
    ];

    const content = `
      var VERSION_INFO={VERSION:"1.0.2",BUILD_TIME:"2026-04-10T17:58:20Z"};
      var a="Alpha prompt body";
      var b=\`Before \${realFirst} after \${realSecond}.\`;
    `;

    const recovered = recoverStringsFileFromContent('1.0.2', content, sources);

    expect(recovered).not.toBeNull();
    expect(recovered?.version).toBe('1.0.2');
    expect(recovered?.prompts).toHaveLength(2);
    expect(recovered?.prompts.map(prompt => prompt.id)).toEqual([
      'static-prompt',
      'templated-prompt',
    ]);
    expect(recovered?.prompts.every(prompt => prompt.version === '1.0.2')).toBe(
      true
    );
  });

  it('prefers the newest matching source for the same prompt id', () => {
    const sources: StringsFile[] = [
      {
        version: '1.0.2',
        prompts: [
          {
            id: 'same-prompt',
            name: 'Same Prompt',
            description: 'Newer',
            pieces: ['Updated body with ${', '}.'],
            identifiers: [0],
            identifierMap: {
              '0': 'VALUE',
            },
            version: '1.0.2',
          },
        ],
      },
      {
        version: '1.0.1',
        prompts: [
          {
            id: 'same-prompt',
            name: 'Same Prompt',
            description: 'Older',
            pieces: ['Older body with ${', '}.'],
            identifiers: [0],
            identifierMap: {
              '0': 'VALUE',
            },
            version: '1.0.1',
          },
        ],
      },
    ];

    const content = 'var prompt=`Updated body with ${actualValue}.`;';
    const recovered = recoverStringsFileFromContent('1.0.3', content, sources);

    expect(recovered).not.toBeNull();
    expect(recovered?.prompts).toHaveLength(1);
    expect(recovered?.prompts[0].pieces).toEqual([
      'Updated body with ${',
      '}.',
    ]);
    expect(recovered?.prompts[0].version).toBe('1.0.3');
  });

  it('returns null when no prompt source matches the current JS', () => {
    const sources: StringsFile[] = [
      {
        version: '1.0.0',
        prompts: [
          {
            id: 'missing',
            name: 'Missing',
            description: 'Missing',
            pieces: ['This will not match'],
            identifiers: [],
            identifierMap: {},
            version: '1.0.0',
          },
        ],
      },
    ];

    expect(
      recoverStringsFileFromContent('1.0.1', 'var nothing="else";', sources)
    ).toBeNull();
  });

  it('discovers unmatched prompt-like literals with synthetic metadata', () => {
    const sources: StringsFile[] = [
      {
        version: '1.0.0',
        prompts: [
          {
            id: 'known',
            name: 'Known',
            description: 'Known',
            pieces: ['Known prompt body'],
            identifiers: [],
            identifierMap: {},
            version: '1.0.0',
          },
        ],
      },
    ];

    const content = `
      var VERSION_INFO={VERSION:"1.0.1",BUILD_TIME:"2026-04-10T17:58:20Z"};
      var known="Known prompt body";
      var fresh=\`# Brand New Prompt

You are a new system prompt with no historical analogue.

IMPORTANT: Work carefully and return a structured answer.

Use this prompt when the user requests something new and specific.
\`;
    `;

    const recovered = recoverStringsFileFromContent('1.0.1', content, sources);

    expect(recovered).not.toBeNull();
    expect(recovered?.prompts).toHaveLength(2);

    const discovered = recovered?.prompts.find(prompt =>
      prompt.id.startsWith('discovered-')
    );

    expect(discovered).toBeDefined();
    expect(discovered?.name).toContain('Brand New Prompt');
    expect(discovered?.pieces).toHaveLength(1);
    expect(discovered?.description).toContain('You are a new system prompt');
  });
});

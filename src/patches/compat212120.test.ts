import { describe, expect, it } from 'vitest';

import { writeContinueResumeCompat212120 } from './compat212120';

describe('writeContinueResumeCompat212120', () => {
  it('repairs the broken continue-mode resume hook stub', () => {
    const input =
      'function RW4(H){return{onBeforeQuery:async()=>!0,onTurnComplete:async()=>{},render:()=>null}}';

    const result = writeContinueResumeCompat212120(input);

    expect(result).toBe(
      'function RW4(H){return{onBeforeQuery:async()=>!0,onTurnComplete:async()=>{},onSessionRestored:()=>{},render:()=>null,ownsInput:!1}}'
    );
  });

  it('is a no-op when the fixed stub is already present', () => {
    const input =
      'function RW4(H){return{onBeforeQuery:async()=>!0,onTurnComplete:async()=>{},onSessionRestored:()=>{},render:()=>null,ownsInput:!1}}';

    expect(writeContinueResumeCompat212120(input)).toBe(input);
  });
});

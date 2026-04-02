import { describe, expect, it, vi } from 'vitest';
import {
  writeAutoLaunchVerificationAgent,
  writeVerificationAgentAvailability,
} from './verificationAgent';

const mockBuiltInAgents =
  'var ul5;var xKK=G(()=>{dY();wA();ul5=`You are the verification specialist.' +
  ' Prompt body`});' +
  'function RnH(){return u$("tengu_amber_stoat",!0)}' +
  'function hV$(){if(dH(process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS)&&Q6())return[];let H=[dd,CKK];if(RnH())H.push(gd,EV$);if(process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-ts"&&process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-py"&&process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-cli")H.push(RKK);return H}';

const mockTaskVerification =
  'async call({todos:H},c){let q=c.getAppState(),K=c.agentId??V$(),_=q.todos[K]??[],A=H.every((t)=>t.status==="completed")?[]:H,z=!1;return c.setAppState((s)=>({...s,todos:{...s.todos,[K]:A}})),{data:{oldTodos:_,newTodos:H,verificationNudgeNeeded:z}}}' +
  'mapToolResultToToolResultBlockParam({verificationNudgeNeeded:H},$){return H}' +
  'let P=!1;return{data:{success:!0,taskId:H,updatedFields:D,statusChange:j.status!==void 0?{from:M.status,to:j.status}:void 0,verificationNudgeNeeded:P}}';

describe('verificationAgentAvailability', () => {
  it('should add the verification agent to the built-in agent list', () => {
    const result = writeVerificationAgentAvailability(mockBuiltInAgents);
    expect(result).toContain("agentType:'verification'");
    expect(result).toContain('getSystemPrompt:()=>ul5');
  });

  it('should no-op when the verification agent is already present', () => {
    const alreadyPatched = mockBuiltInAgents.replace(
      'if(process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-ts"&&process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-py"&&process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-cli")H.push(RKK);return H',
      'H.push({...dd,agentType:"verification"});if(process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-ts"&&process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-py"&&process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-cli")H.push(RKK);return H'
    );
    const result = writeVerificationAgentAvailability(alreadyPatched);
    expect(result).toBe(alreadyPatched);
  });

  it('should still no-op on already-patched code even if the verifier prompt text drifts', () => {
    const alreadyPatched = mockBuiltInAgents
      .replace(
        'if(process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-ts"&&process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-py"&&process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-cli")H.push(RKK);return H',
        'H.push({...dd,agentType:"verification"});if(process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-ts"&&process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-py"&&process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-cli")H.push(RKK);return H'
      )
      .replace(
        'You are the verification specialist.',
        'You are another agent.'
      );
    const result = writeVerificationAgentAvailability(alreadyPatched);
    expect(result).not.toBeNull();
  });
});

describe('autoLaunchVerificationAgent', () => {
  it('should no-op when verification auto-launch is already present', () => {
    const alreadyPatched = mockTaskVerification.replace(
      'verificationNudgeNeeded:z',
      'verificationNudgeNeeded:z,subagent_type:"verification"'
    );
    const result = writeAutoLaunchVerificationAgent(alreadyPatched);
    expect(result).toBe(alreadyPatched);
  });

  it('should return null when the TodoWrite block is not found', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = writeAutoLaunchVerificationAgent(
      mockTaskVerification.replace('verificationNudgeNeeded:z', 'nope:z')
    );
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});

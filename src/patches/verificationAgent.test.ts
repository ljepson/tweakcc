import { describe, expect, it, vi } from 'vitest';
import {
  writeAutoLaunchVerificationAgent,
  writeVerificationAgentAvailability,
} from './verificationAgent';

const mockBuiltInAgents =
  'var ul5;var xKK=G(()=>{dY();wA();ul5=`You are the verification specialist.' +
  ' Prompt body`});' +
  'function RnH(){return u$("tengu_amber_stoat",!0)}' +
  'function hV$(){if(dH(process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS)&&Q6())return[];let H=[dd,CKK];if(RnH())H.push(gd,EV$);H.push({...dd,agentType:"verification"});if(process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-ts"&&process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-py"&&process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-cli")H.push(RKK);return H}';

const mockTaskVerification =
  'async call({todos:H},$){let q=$.getAppState(),K=$.agentId??V$(),_=q.todos[K]??[],A=H.every((O)=>O.status==="completed")?[]:H,z=!1;return $.setAppState((O)=>({...O,todos:{...O.todos,[K]:A}})),{data:{oldTodos:_,newTodos:H,verificationNudgeNeeded:z}}}' +
  'mapToolResultToToolResultBlockParam({verificationNudgeNeeded:H},$){return H}' +
  'let P=!1;return{data:{success:!0,taskId:H,updatedFields:D,statusChange:j.status!==void 0?{from:M.status,to:j.status}:void 0,verificationNudgeNeeded:P}}';

describe('verificationAgentAvailability', () => {
  it('should add the built-in verification agent to the active agent list', () => {
    const result = writeVerificationAgentAvailability(mockBuiltInAgents);
    expect(result).not.toBeNull();
    expect(result).toContain("agentType:'verification'");
    expect(result).toContain('getSystemPrompt:()=>ul5');
    expect(result).toContain('background:!0');
  });

  it('should return null when the verifier prompt block is not found', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = writeVerificationAgentAvailability(
      mockBuiltInAgents.replace(
        'You are the verification specialist.',
        'You are another agent.'
      )
    );
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});

describe('autoLaunchVerificationAgent', () => {
  it('should auto-launch the verifier from TodoWrite and TaskUpdate closeout points', () => {
    const result = writeAutoLaunchVerificationAgent(mockTaskVerification);
    expect(result).not.toBeNull();
    expect(result).toContain("description:'Verify recent completed work'");
    expect(result).toContain(
      "description:'Verify recently completed task list'"
    );
    expect(result).toContain("subagent_type:'verification'");
    expect(result).toContain('run_in_background:!0');
    expect(result).toContain("H.name==='Agent'");
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

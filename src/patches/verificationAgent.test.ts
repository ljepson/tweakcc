import { describe, expect, it, vi } from 'vitest';
import {
  writeAutoLaunchVerificationAgent,
  writeVerificationAgentAvailability,
} from './verificationAgent';

const mockBuiltInAgents =
  'var ul5;var xKK=Gz(()=>{rY();wQ();ul5=`You are the verification specialist.' +
  ' Prompt body`});' +
  'function RnH(){return u$("tengu_amber_stoat",!0)}' +
  'function hV$(){if(pH(process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS)&&X6())return[];let H=[dd,CKK];if(RnH())H.push(gd,EV$);if(process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-ts"&&process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-py"&&process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-cli")H.push(RKK);return H}';

const mockTaskVerification =
  'async function m2(H){let $=BC(H),q;try{q=await yG.readdir($)}catch{return[]}let K=q.filter((f)=>f.endsWith(".json")).map((f)=>f.replace(".json",""));return(await Promise.all(K.map((f)=>Dp(H,f)))).filter((f)=>f!==null)}' +
  'async call({todos:H},c){let q=c.getAppState(),K=c.agentId??k$(),_=q.todos[K]??[],A=H.every((t)=>t.status==="completed")?[]:H,z=!1;return c.setAppState((s)=>({...s,todos:{...s.todos,[K]:A}})),{data:{oldTodos:_,newTodos:H,verificationNudgeNeeded:z}}}' +
  'mapToolResultToToolResultBlockParam({verificationNudgeNeeded:H},$){return H}' +
  'async call({taskId:H,subject:$,description:q,activeForm:K,status:_,owner:f,addBlocks:A,addBlockedBy:z,metadata:O},Y){let w=Fv();let M=await Dp(w,H);let D=[],j={};if(Object.keys(j).length>0)await vU(w,H,j);let P=!1;return{data:{success:!0,taskId:H,updatedFields:D,statusChange:j.status!==void 0?{from:M.status,to:j.status}:void 0,verificationNudgeNeeded:P}}}';

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
  it('should inject a syntactically valid permission callback', () => {
    const result = writeAutoLaunchVerificationAgent(mockTaskVerification);
    expect(result).toContain(`async(O,Y)=>({behavior:'allow',updatedInput:Y})`);
    expect(result).toContain(
      `prompt:"Verify the recent implementation changes from the parent conversation. Review the parent's current-turn tool calls and issue a PASS, FAIL, or PARTIAL verdict with command evidence."`
    );
    expect(result).toContain(`await m2(w)`);
  });

  it('should not destroy unrelated microcompact or session-memory shapes', () => {
    const coupledBundle =
      mockTaskVerification +
      'var W7K=G(()=>{e8();Gg4={enabled:!1,gapThresholdMinutes:60,keepRecent:5}});' +
      'let config={minimumMessageTokensToInit:1e4,minimumTokensBetweenUpdate:5000,toolCallsBetweenUpdates:3};';
    const result = writeAutoLaunchVerificationAgent(coupledBundle);
    expect(result).toContain(
      'var W7K=G(()=>{e8();Gg4={enabled:!1,gapThresholdMinutes:60,keepRecent:5}});'
    );
    expect(result).toContain('minimumMessageTokensToInit:1e4');
    expect(result).toContain('minimumTokensBetweenUpdate:5000');
    expect(result).toContain('toolCallsBetweenUpdates:3');
  });

  it('should no-op when verification auto-launch is already present', () => {
    const alreadyPatched = mockTaskVerification.replace(
      'mapToolResultToToolResultBlockParam({verificationNudgeNeeded:H},$){return H}',
      `let __tweakccVerifierTool=Y.options.tools.find((O)=>O.name==="Agent");await __tweakccVerifierTool.call({description:'Verify recently completed task list'});mapToolResultToToolResultBlockParam({verificationNudgeNeeded:H},$){return H}`
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

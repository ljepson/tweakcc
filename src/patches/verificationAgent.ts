// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeVerificationAgentAvailability = (
  oldFile: string
): string | null => {
  if (
    oldFile.includes("agentType:'verification'") ||
    oldFile.includes('agentType:"verification"')
  ) {
    return oldFile;
  }

  const verifierPromptPattern =
    /var ([$\w]+);var [$\w]+=G\(\(\)=>\{dY\(\);wA\(\);\1=`You are the verification specialist\./;
  const verifierPromptMatch = oldFile.match(verifierPromptPattern);

  if (!verifierPromptMatch) {
    console.error(
      'patch: verificationAgentAvailability: failed to find verifier prompt'
    );
    return null;
  }

  const verifierPromptVar = verifierPromptMatch[1];

  // 2.1.89 binary shape:
  // function hV$(){if(dH(process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS)&&Q6())return[];
  // let H=[dd,CKK];if(RnH())H.push(gd,EV$);
  // if(process.env.CLAUDE_CODE_ENTRYPOINT!=="sdk-ts"&&...)H.push(RKK);return H}
  const builtInAgentsPattern =
    /function ([$\w]+)\(\)\{if\(dH\(process\.env\.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS\)&&Q6\(\)\)return\[\];let ([$\w]+)=\[([$\w]+),([$\w]+)\];if\(([$\w]+)\(\)\)\2\.push\(([$\w]+),([$\w]+)\);if\(process\.env\.CLAUDE_CODE_ENTRYPOINT!==["']sdk-ts["']&&process\.env\.CLAUDE_CODE_ENTRYPOINT!==["']sdk-py["']&&process\.env\.CLAUDE_CODE_ENTRYPOINT!==["']sdk-cli["']\)\2\.push\(([$\w]+)\);return \2\}/g;
  const builtInAgentsMatch = Array.from(
    oldFile.matchAll(builtInAgentsPattern)
  )[0];

  if (!builtInAgentsMatch || builtInAgentsMatch.index === undefined) {
    console.error(
      'patch: verificationAgentAvailability: failed to find built-in agents function'
    );
    return null;
  }

  const fnName = builtInAgentsMatch[1];
  const agentsVar = builtInAgentsMatch[2];
  const generalAgentVar = builtInAgentsMatch[3];
  const statuslineAgentVar = builtInAgentsMatch[4];
  const explorePlanGateFn = builtInAgentsMatch[5];
  const exploreAgentVar = builtInAgentsMatch[6];
  const planAgentVar = builtInAgentsMatch[7];
  const cliAgentVar = builtInAgentsMatch[8];

  // In 2.1.89, the verification agent is ALREADY partially in H.push,
  // but we want to ensure it is always there and has the right prompt.
  // We will rewrite the function to be clean.
  const replacement = `function ${fnName}(){if(dH(process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS)&&Q6())return[];let ${agentsVar}=[${generalAgentVar},${statuslineAgentVar}];if(${explorePlanGateFn}())${agentsVar}.push(${exploreAgentVar},${planAgentVar});${agentsVar}.push({...${generalAgentVar},agentType:'verification',whenToUse:'Use this agent to verify that implementation work is correct before reporting completion. Invoke after non-trivial tasks (3+ file edits, backend/API changes, infrastructure changes).',color:'red',background:!0,model:'inherit',getSystemPrompt:()=>${verifierPromptVar}});if(process.env.CLAUDE_CODE_ENTRYPOINT!=='sdk-ts'&&process.env.CLAUDE_CODE_ENTRYPOINT!=='sdk-py'&&process.env.CLAUDE_CODE_ENTRYPOINT!=='sdk-cli')${agentsVar}.push(${cliAgentVar});return ${agentsVar}}`;

  const startIndex = builtInAgentsMatch.index;
  const endIndex = startIndex + builtInAgentsMatch[0].length;
  const newFile =
    oldFile.slice(0, startIndex) + replacement + oldFile.slice(endIndex);

  showDiff(
    oldFile,
    newFile,
    'Verification Agent Availability',
    startIndex,
    endIndex
  );
  return newFile;
};

export const writeAutoLaunchVerificationAgent = (
  oldFile: string
): string | null => {
  if (
    oldFile.includes("description:'Verify recent completed work'") ||
    oldFile.includes("description:'Verify recently completed task list'") ||
    oldFile.includes('description:"Verify recent completed work"') ||
    oldFile.includes('description:"Verify recently completed task list"')
  ) {
    return oldFile;
  }

  let newFile = oldFile;

  const todoPattern =
    /([$\w]+)=!1;return ([$\w]+)\.setAppState\(\(([$\w]+)\)=>\(\{\.\.\.\3,todos:\{\.\.\.\3\.todos,\[([$\w]+)\]:([$\w]+)\}\}\)\),\{data:\{oldTodos:([$\w]+),newTodos:([$\w]+),verificationNudgeNeeded:\1\}\}/;
  const todoMatch = newFile.match(todoPattern);

  if (!todoMatch || todoMatch.index === undefined) {
    console.error(
      'patch: autoLaunchVerificationAgent: failed to find TodoWrite verification block'
    );
    return null;
  }

  const nudgeVar = todoMatch[1];
  const contextVar = todoMatch[2];
  const prevStateVar = todoMatch[3];
  const todoKeyVar = todoMatch[4];
  const newTodosVar = todoMatch[5];
  const oldTodosVar = todoMatch[6];
  const todosVar = todoMatch[7];

  const todoReplacement = `${nudgeVar}=!1;if(!${contextVar}.agentId&&${todosVar}.every((O)=>O.status==="completed")&&${todosVar}.length>=3&&!${todosVar}.some((O)=>/verif/i.test(O.content))){let __tweakccVerifierTool=${contextVar}.options.tools.find((O)=>O.name==="Agent");if(__tweakccVerifierTool&&typeof __tweakccVerifierTool.call==="function")try{await __tweakccVerifierTool.call({description:'Verify recent completed work',prompt:"Verify the recent implementation changes from the parent conversation. Review the parent's current-turn tool calls and issue a PASS, FAIL, or PARTIAL verdict with command evidence.",subagent_type:'verification',model:'haiku',run_in_background:!0},${contextVar},async(O,Y)=>({behavior:'allow',updatedInput:Y}))}catch{${nudgeVar}=!0}else ${nudgeVar}=!0}return ${contextVar}.setAppState((${prevStateVar})=>({...${prevStateVar},todos:{...${prevStateVar}.todos,[${todoKeyVar}]:${newTodosVar}}})),{data:{oldTodos:${oldTodosVar},newTodos:${todosVar},verificationNudgeNeeded:${nudgeVar}}}`;

  let startIndex = todoMatch.index;
  let endIndex = startIndex + todoMatch[0].length;
  newFile =
    newFile.slice(0, startIndex) + todoReplacement + newFile.slice(endIndex);
  showDiff(oldFile, newFile, todoReplacement, startIndex, endIndex);

  const taskPattern =
    /let ([$\w]+)=([$\w]+)\(\);[\s\S]*?let ([$\w]+)=!1;return\{data:\{success:!0,taskId:([$\w]+),updatedFields:([$\w]+),statusChange:([$\w]+)\.status!==void 0\?\{from:([$\w]+)\.status,to:\6\.status\}:void 0,verificationNudgeNeeded:\3\}\}/;
  const taskMatch = newFile.match(taskPattern);

  if (!taskMatch || taskMatch.index === undefined) {
    console.error(
      'patch: autoLaunchVerificationAgent: failed to find TaskUpdate verification nudge block'
    );
    return null;
  }

  const taskStoreVar = taskMatch[1];
  const taskListFn = taskMatch[2];
  const taskNudgeVar = taskMatch[3];
  const taskIdVar = taskMatch[4];
  const updatedFieldsVar = taskMatch[5];
  const updatesVar = taskMatch[6];
  const existingTaskVar = taskMatch[7];

  const taskReplacement = `let ${taskNudgeVar}=!1;if(${updatesVar}.status==="completed"&&!Y.agentId){let __tweakccAllTasks=await ${taskListFn}(${taskStoreVar}),__tweakccAllDone=__tweakccAllTasks.every((O)=>O.status==="completed");if(__tweakccAllDone&&__tweakccAllTasks.length>=3&&!__tweakccAllTasks.some((O)=>/verif/i.test(O.subject))){let __tweakccVerifierTool=Y.options.tools.find((O)=>O.name==="Agent");if(__tweakccVerifierTool&&typeof __tweakccVerifierTool.call==="function")try{await __tweakccVerifierTool.call({description:'Verify recently completed task list',prompt:"Verify the recent implementation changes from the parent conversation. Review the parent's current-turn tool calls and issue a PASS, FAIL, or PARTIAL verdict with command evidence.",subagent_type:'verification',model:'haiku',run_in_background:!0},Y,async(O,J)=>({behavior:'allow',updatedInput:J}))}catch{${taskNudgeVar}=!0}else ${taskNudgeVar}=!0}}return{data:{success:!0,taskId:${taskIdVar},updatedFields:${updatedFieldsVar},statusChange:${updatesVar}.status!==void 0?{from:${existingTaskVar}.status,to:${updatesVar}.status}:void 0,verificationNudgeNeeded:${taskNudgeVar}}}`;

  startIndex = taskMatch.index;
  endIndex = startIndex + taskMatch[0].length;
  const afterTaskFile =
    newFile.slice(0, startIndex) + taskReplacement + newFile.slice(endIndex);
  showDiff(newFile, afterTaskFile, taskReplacement, startIndex, endIndex);
  return afterTaskFile;
};

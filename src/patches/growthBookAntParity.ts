// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeGrowthBookAntParity = (oldFile: string): string | null => {
  const pattern =
    /function ([$\w]+)\(\)\{return\}function ([$\w]+)\(\)\{if\(([$\w]+)\.size>0\)return Object\.fromEntries\(\3\);return ([$\w]+)\(\)\.cachedGrowthBookFeatures\?\?\{\}\}function ([$\w]+)\(\)\{return \1\(\)\?\?\{\}\}function ([$\w]+)\(H,\$\)\{return\}function ([$\w]+)\(\)\{return\}/;
  const match = oldFile.match(pattern);

  if (!match || match.index === undefined) {
    console.error(
      'patch: growthBookAntParity: failed to find GrowthBook override stub block'
    );
    return null;
  }

  const envFnName = match[1];
  const cachedFeaturesFnName = match[2];
  const stateMapName = match[3];
  const configGetterFnName = match[4];
  const configOverridesFnName = match[5];
  const setOverrideFnName = match[6];
  const clearOverridesFnName = match[7];
  const startIndex = match.index;
  const endIndex = startIndex + match[0].length;
  const replacement =
    `function ${envFnName}(){let H=globalThis.__tweakccGbEnvOverridesCache;if(H!==void 0)return H;let $=process.env.CLAUDE_INTERNAL_FC_OVERRIDES;if(!$)return globalThis.__tweakccGbEnvOverridesCache=null,null;try{return globalThis.__tweakccGbEnvOverridesCache=JSON.parse($)}catch{return globalThis.__tweakccGbEnvOverridesCache=null,null}}` +
    `function ${cachedFeaturesFnName}(){if(${stateMapName}.size>0)return Object.fromEntries(${stateMapName});return ${configGetterFnName}().cachedGrowthBookFeatures??{}}` +
    `function ${configOverridesFnName}(){return ${envFnName}()??${configGetterFnName}().growthBookOverrides??{}}` +
    `function ${setOverrideFnName}(H,$){return}` +
    `function ${clearOverridesFnName}(){return}`;

  const newFile =
    oldFile.slice(0, startIndex) + replacement + oldFile.slice(endIndex);
  showDiff(oldFile, newFile, replacement, startIndex, endIndex);
  return newFile;
};

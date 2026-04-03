// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeGrowthBookAntParity = (oldFile: string): string | null => {
  if (
    oldFile.includes('globalThis.__tweakccGbEnvOverridesCache') &&
    oldFile.includes('process.env.CLAUDE_INTERNAL_FC_OVERRIDES') &&
    oldFile.includes('growthBookOverrides??{}') &&
    oldFile.includes('Object.keys(K).length>0')
  ) {
    return oldFile;
  }

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
    `function ${envFnName}(){let H=globalThis.__tweakccGbEnvOverridesCache;if(H!==void 0)return H;let $=process.env.CLAUDE_INTERNAL_FC_OVERRIDES;if($){try{return globalThis.__tweakccGbEnvOverridesCache=JSON.parse($)}catch{}}try{let K=${configGetterFnName}().growthBookOverrides;if(K&&Object.keys(K).length>0)return globalThis.__tweakccGbEnvOverridesCache=K}catch{return null}return globalThis.__tweakccGbEnvOverridesCache=null,null}` +
    `function ${cachedFeaturesFnName}(){if(${stateMapName}.size>0)return Object.fromEntries(${stateMapName});return ${configGetterFnName}().cachedGrowthBookFeatures??{}}` +
    `function ${configOverridesFnName}(){return ${envFnName}()??${configGetterFnName}().growthBookOverrides??{}}` +
    `function ${setOverrideFnName}(H,$){let q=${configGetterFnName}();if($===void 0){let K=q.growthBookOverrides??{};if(!(H in K))return;let {[H]:_,...f}=K;S$((A)=>{let z={...A};if(Object.keys(f).length>0)z.growthBookOverrides=f;else delete z.growthBookOverrides;return z}),HZH.emit();return}let K=q.growthBookOverrides??{};if(K[H]===$)return;S$((_)=>({..._,growthBookOverrides:{...(_.growthBookOverrides??{}),[H]:$}})),HZH.emit()}` +
    `function ${clearOverridesFnName}(){let H=${configGetterFnName}();if(!H.growthBookOverrides||Object.keys(H.growthBookOverrides).length===0)return;S$(($)=>{let q={...$};delete q.growthBookOverrides;return q}),HZH.emit()}`;

  const newFile =
    oldFile.slice(0, startIndex) + replacement + oldFile.slice(endIndex);
  showDiff(oldFile, newFile, replacement, startIndex, endIndex);
  return newFile;
};

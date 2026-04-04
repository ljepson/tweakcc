import { escapeIdent, showDiff } from './index';

export const writeKairos = (oldFile: string): string | null => {
  const kairosManager = `
globalThis.__tweakccKairos = new class KairosManager {
  constructor() {
    this.tickIntervalMs = 270000; // 4.5 minutes
    this.idleTicks = 0;
    this.maxIdleTicks = 3;
    this.isFocused = true;
    this.lastTickTime = Date.now();
    this.autonomousCostUsd = 0;
    this.isDeepSleep = false;
  }

  isKairosEnabled() {
    return globalThis.__tweakccConfig?.settings?.antParity?.enableKairos ?? false;
  }

  updateFocus(focused) {
    if (this.isFocused === focused) return;
    this.isFocused = focused;
    if (focused) {
      if (this.isDeepSleep) {
        this.isDeepSleep = false;
        this.idleTicks = 0;
      }
      this.lastTickTime = 0;
    }
  }

  getSystemPromptFragment() {
    if (!this.isKairosEnabled()) return "";
    return "\\n\\n[KAIROS AUTO-MODE] " + (this.isFocused
      ? "User is watching. Propose actions and wait for confirmation via SendUserMessage."
      : "User is away. You are authorized to act autonomously: execute tests, perform commits, and manage the environment. Brief the user on return.");
  }

  checkTick(onFire) {
    if (!this.isKairosEnabled() || this.isDeepSleep) return;

    if (require("fs").existsSync(require("path").join(require("os").homedir(), ".claude", "kairos-stop"))) {
       this.isDeepSleep = true;
       return;
    }

    let now = Date.now();
    let interval = this.isFocused ? 60000 : this.tickIntervalMs;
    if (now - this.lastTickTime >= interval) {
      this.lastTickTime = now;
      this.idleTicks++;
      if (this.idleTicks > this.maxIdleTicks && !this.isFocused) {
        this.isDeepSleep = true;
        return;
      }
      onFire(\`<tick>\${new Date().toLocaleTimeString()}</tick>\`);
    }
  }
}();
`;

  // Inject after Bun CommonJS wrapper to not before header
  // The wrapper looks like: // @bun ... \n(function(exports, require, module, __filename, __dirname) {
  const BUN_CJS_MARKER =
    '(function(exports, require, module, __filename, __dirname) {';
  const markerIdx = oldFile.indexOf(BUN_CJS_MARKER);
  let newFile: string;
  if (markerIdx !== -1) {
    // Inject after the wrapper opening
    const insertPoint = markerIdx + BUN_CJS_MARKER.length;
    newFile =
      oldFile.slice(0, insertPoint) +
      '\n' +
      kairosManager +
      oldFile.slice(insertPoint);
  } else {
    // Fallback: prepend (for non-Bun bundles)
    newFile = kairosManager + oldFile;
  }

  // 1. Enable KAIROS feature gates
  // Phase 1: discover the gate function name from its call site
  const gateCallPattern = /([$\w]+)\("tengu_kairos_cron"/;
  const gateCallMatch = newFile.match(gateCallPattern);
  if (gateCallMatch) {
    const gateFnName = gateCallMatch[1];
    // Phase 2: find its definition and capture the first param (feature name arg)
    const gateFnPattern = new RegExp(
      `function ${escapeIdent(gateFnName)}\\(([$\\w]+)[^)]*\\)\\{`
    );
    const gateFnMatch = newFile.match(gateFnPattern);
    if (gateFnMatch) {
      const featureParam = gateFnMatch[1];
      newFile = newFile.replace(
        gateFnMatch[0],
        gateFnMatch[0] +
          `if(globalThis.__tweakccKairos?.isKairosEnabled() && (${featureParam}==="tengu_kairos_cron" || ${featureParam}==="tengu_kairos_brief")) return true;`
      );
    }
  }

  // 2. Patch system prompt
  const wa6Pattern =
    /return\{defaultSystemPrompt:([$\w]+),userContext:([$\w]+),systemContext:([$\w]+)\}/;
  const wa6Match = newFile.match(wa6Pattern);
  if (wa6Match) {
    newFile = newFile.replace(
      wa6Match[0],
      `return{defaultSystemPrompt:[...${wa6Match[1]}, globalThis.__tweakccKairos.getSystemPromptFragment()],userContext:${wa6Match[2]},systemContext:${wa6Match[3]}}`
    );
  }

  // 3. Inject tick loop into print loop
  // Expanded pattern captures all minified names needed for the replacement:
  //   1: scheduler var        (VH)
  //   2: cron manager         (Gs7)
  //   3: cron config          (Zs7)
  //   4: killed flag          (X)     - from if(X)return inside onFire
  //   5: prompt inject fn     (_M)    - sends prompt messages
  //   6: UUID source          (Rj)    - .randomUUID()
  //   7: workload constant    (OZ$)   - "cron"
  //   8: flush fn             (JH)    - called after prompt inject
  //   9: loading flag         (j)     - from isLoading:()=>j||X
  const vkfNeedle =
    /let ([$\w]+)=null;if\(([$\w]+)&&([$\w]+)\?\.isKairosCronEnabled\(\)\)\1=\2\.createCronScheduler\(\{onFire:\([$\w]+\)=>\{if\(([$\w]+)\)return;([$\w]+)\(\{mode:"prompt",value:[$\w]+,uuid:([$\w]+)\.randomUUID\(\),priority:"later",isMeta:!0,workload:([$\w]+)\}\),([$\w]+)\(\)\},isLoading:\(\)=>([$\w]+)\|\|\4/;
  const vkfMatch = newFile.match(vkfNeedle);
  if (vkfMatch) {
    const kVar = vkfMatch[1];
    const cronMgr = vkfMatch[2];
    const cronCfg = vkfMatch[3];
    const killedFlag = vkfMatch[4];
    const promptFn = vkfMatch[5];
    const uuidSrc = vkfMatch[6];
    const workloadConst = vkfMatch[7];
    const flushFn = vkfMatch[8];
    const loadingFlag = vkfMatch[9];
    const replacement =
      `let ${kVar}=null; if(globalThis.__tweakccKairos.isKairosEnabled()){${kVar}={start:function(){this.iv=setInterval(()=>{` +
      `if(typeof ${loadingFlag}!=="undefined"&&!${loadingFlag}&&typeof ${killedFlag}!=="undefined"&&!${killedFlag})` +
      `globalThis.__tweakccKairos.checkTick((v)=>{${promptFn}({mode:"prompt",value:v,uuid:${uuidSrc}.randomUUID(),priority:"later",isMeta:!0,workload:${workloadConst}});${flushFn}()})` +
      `},5000)},stop:function(){clearInterval(this.iv)}};${kVar}.start()}else if(${cronMgr}&&${cronCfg}?.isKairosCronEnabled())` +
      `${kVar}=${cronMgr}.createCronScheduler({onFire:(${kVar}_v)=>{if(${killedFlag})return;${promptFn}({mode:"prompt",value:${kVar}_v,uuid:${uuidSrc}.randomUUID(),priority:"later",isMeta:!0,workload:${workloadConst}}),${flushFn}()},isLoading:()=>${loadingFlag}||${killedFlag}`;
    newFile = newFile.replace(vkfMatch[0], replacement);
  }

  // 4. Inject focus tracking into Ink class
  const inkPattern =
    /class ([$\w]+)\{[$\w;=!]*constructor\(([$\w]+)\)\{this\.options=\2;/;
  const inkMatch = newFile.match(inkPattern);
  if (inkMatch) {
    const ctorParam = inkMatch[2];
    newFile = newFile.replace(
      inkMatch[0],
      inkMatch[0] +
        `${ctorParam}.stdout.on("focus_gained",()=>globalThis.__tweakccKairos?.updateFocus(true));${ctorParam}.stdout.on("focus_lost",()=>globalThis.__tweakccKairos?.updateFocus(false));`
    );
  }

  // 5. Cost tracking
  // First, discover workload getter and cron constant from their definitions
  const workloadGetterPattern =
    /function ([$\w]+)\(\)\{return ([$\w]+)\.getStore\(\)\?\.workload\}/;
  const workloadGetterMatch = newFile.match(workloadGetterPattern);
  const cronConstPattern = /([$\w]+)="cron"/;
  const cronConstMatch = newFile.match(cronConstPattern);

  const costPattern = /this\.totalUsage=([$\w]+)\(this\.totalUsage,([$\w]+)\)/;
  const costMatch = newFile.match(costPattern);
  if (costMatch && workloadGetterMatch && cronConstMatch) {
    const workloadGetter = workloadGetterMatch[1];
    const cronConst = cronConstMatch[1];
    newFile = newFile.replace(
      costMatch[0],
      `this.totalUsage=${costMatch[1]}(this.totalUsage,${costMatch[2]}); if(globalThis.__tweakccKairos?.isKairosEnabled() && ${workloadGetter}()===${cronConst}) globalThis.__tweakccKairos.autonomousCostUsd += (this.totalUsage.cost ?? 0);`
    );
  }

  showDiff(oldFile, newFile, 'KAIROS Tick Loop', 0, 100);
  return newFile;
};

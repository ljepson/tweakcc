import { showDiff } from './index';

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

  // Inject after CommonJS wrapper, not before Bun header
  // Pattern: // @bun @bytecode @bun-cjs\n(function(exports, require, module, __filename, __dirname) {
  const cjsWrapperPattern =
    /(^\/\/ @bun[^\n]*\n\(function\(exports, require, module, __filename, __dirname\) \{)/;
  const cjsMatch = oldFile.match(cjsWrapperPattern);
  let newFile: string;
  if (cjsMatch) {
    // Inject after the wrapper opening
    newFile = oldFile.replace(cjsMatch[0], cjsMatch[0] + '\n' + kairosManager);
  } else {
    // Fallback: prepend (for non-Bun bundles)
    newFile = kairosManager + oldFile;
  }

  // 1. Enable KAIROS feature gates in u$
  const uPattern = /function u\$\(H,\$\)\{/;
  const uMatch = newFile.match(uPattern);
  if (uMatch) {
    newFile = newFile.replace(
      uMatch[0],
      uMatch[0] +
        'if(globalThis.__tweakccKairos?.isKairosEnabled() && (H==="tengu_kairos_cron" || H==="tengu_kairos_brief")) return true;'
    );
  }

  // 2. Patch system prompt (wA6)
  const wa6Pattern =
    /return\{defaultSystemPrompt:([$\w]+),userContext:([$\w]+),systemContext:([$\w]+)\}/;
  const wa6Match = newFile.match(wa6Pattern);
  if (wa6Match) {
    newFile = newFile.replace(
      wa6Match[0],
      `return{defaultSystemPrompt:[...${wa6Match[1]}, globalThis.__tweakccKairos.getSystemPromptFragment()],userContext:${wa6Match[2]},systemContext:${wa6Match[3]}}`
    );
  }

  // 3. Inject tick loop into Vkf (print loop)
  const vkfNeedle =
    /let ([$\w]+)=null;if\(([$\w]+)&&([$\w]+)\?\.isKairosCronEnabled\(\)\)/;
  const vkfMatch = newFile.match(vkfNeedle);
  if (vkfMatch) {
    const kVar = vkfMatch[1];
    const replacement = `let ${kVar}=null; if(globalThis.__tweakccKairos.isKairosEnabled()){${kVar}={start:function(){this.iv=setInterval(()=>{if(typeof j!=="undefined"&&!j&&typeof X!=="undefined"&&!X)globalThis.__tweakccKairos.checkTick((v)=>{nD({mode:"prompt",value:v,uuid:DP.randomUUID(),priority:"later",isMeta:!0,workload:$W$});yH()})},5000)},stop:function(){clearInterval(this.iv)}};${kVar}.start()}else if(${vkfMatch[2]}&&${vkfMatch[3]}?.isKairosCronEnabled())`;
    newFile = newFile.replace(vkfMatch[0], replacement);
  }

  // 4. Inject focus tracking into cQH (Ink)
  const inkPattern = /class cQH\{[$\w;=!]*constructor\(H\)\{this\.options=H;/;
  const inkMatch = newFile.match(inkPattern);
  if (inkMatch) {
    newFile = newFile.replace(
      inkMatch[0],
      inkMatch[0] +
        'H.stdout.on("focus_gained",()=>globalThis.__tweakccKairos?.updateFocus(true));H.stdout.on("focus_lost",()=>globalThis.__tweakccKairos?.updateFocus(false));'
    );
  }

  // 5. Cost tracking
  const costPattern = /this\.totalUsage=([$\w]+)\(this\.totalUsage,([$\w]+)\)/;
  const costMatch = newFile.match(costPattern);
  if (costMatch) {
    newFile = newFile.replace(
      costMatch[0],
      `this.totalUsage=${costMatch[1]}(this.totalUsage,${costMatch[2]}); if(globalThis.__tweakccKairos?.isKairosEnabled() && (typeof J!=="undefined" && J===(typeof $W$!=="undefined"?$W$:null))) globalThis.__tweakccKairos.autonomousCostUsd += (this.totalUsage.cost ?? 0);`
    );
  }

  showDiff(oldFile, newFile, 'KAIROS Tick Loop', 0, 100);
  return newFile;
};

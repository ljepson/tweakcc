import { stringifyRegex } from '@/utils';
import { InputPatternHighlighter } from '../types';
import { findChalkVar, showDiff } from './index';

// ======================================================================

const buildChalkChain = (
  chalkVar: string,
  highlighter: InputPatternHighlighter
): string => {
  let chain = chalkVar;

  if (highlighter.foregroundColor) {
    const fgMatch = highlighter.foregroundColor.match(/\d+/g);
    if (fgMatch) {
      chain += `.rgb(${fgMatch.join(',')})`;
    }
  }

  if (highlighter.backgroundColor) {
    const bgMatch = highlighter.backgroundColor.match(/\d+/g);
    if (bgMatch) {
      chain += `.bgRgb(${bgMatch.join(',')})`;
    }
  }

  if (highlighter.styling.includes('bold')) chain += '.bold';
  if (highlighter.styling.includes('italic')) chain += '.italic';
  if (highlighter.styling.includes('underline')) chain += '.underline';
  if (highlighter.styling.includes('strikethrough')) chain += '.strikethrough';
  if (highlighter.styling.includes('inverse')) chain += '.inverse';

  return chain;
};

// ======================================================================

const writeCustomHighlighterImpl = (oldFile: string): string | null => {
  // Pattern A (older CC): if(VAR.highlight?.color)return createElement(...)
  const regexA =
    /(if\(([$\w]+)\.highlight\?\.color\))((return [$\w]+\.createElement\([$\w]+,\{key:[$\w]+),color:[$\w]+\.highlight\.color(\},[$\w]+\.createElement\([$\w]+,null,)([$\w]+\.text)(\)\)));/;

  let matches = oldFile.match(regexA);
  if (matches && matches.index !== undefined) {
    const styledFormattedText = `${matches[2]}.highlight.color(${matches[6]})`;

    const replacement =
      matches[1] +
      `{if(typeof ${matches[2]}.highlight.color==='function')` +
      matches[4] +
      matches[5] +
      styledFormattedText +
      matches[7] +
      ';else ' +
      matches[3] +
      '}';

    const newFile =
      oldFile.slice(0, matches.index) +
      replacement +
      oldFile.slice(matches.index + matches[0].length);

    showDiff(
      oldFile,
      newFile,
      replacement,
      matches.index,
      matches.index + matches[0].length
    );
    return newFile;
  }

  // Pattern B (CC 2.1.86+ React Compiler): no if guard, color via optional chaining
  // return REACT.createElement(COMP,{key:K,color:VAR.highlight?.color,...},REACT.createElement(COMP2,null,VAR.text))
  const regexB =
    /return ([$\w]+)\.createElement\(([$\w]+),\{key:([$\w]+),color:([$\w]+)\.highlight\?\.color(?:,[$\w]+:[$\w]+\.highlight\?\.[$\w]+)*\},([$\w]+)\.createElement\(([$\w]+),null,([$\w]+)\.text\)\)/;
  matches = oldFile.match(regexB);
  if (!matches || matches.index === undefined) {
    console.error(
      'patch: inputPatternHighlighters: failed to find highlight?.color renderer pattern'
    );
    return null;
  }

  const fullMatch = matches[0];
  const reactExpr = matches[1];
  const textComp = matches[2];
  const keyVar = matches[3];
  const itemVar = matches[4];
  const reactExpr2 = matches[5];
  const innerComp = matches[6];
  const textPropVar = matches[7];

  const exprOnly = fullMatch.slice('return '.length);

  const replacement =
    `return (typeof ${itemVar}.highlight?.color==='function'?` +
    `${reactExpr}.createElement(${textComp},{key:${keyVar}},` +
    `${reactExpr2}.createElement(${innerComp},null,` +
    `${itemVar}.highlight.color(${textPropVar}.text)))` +
    `:${exprOnly})`;

  const startIndex = matches.index;
  const endIndex = startIndex + fullMatch.length;
  const newFile =
    oldFile.slice(0, startIndex) + replacement + oldFile.slice(endIndex);
  showDiff(oldFile, newFile, replacement, startIndex, endIndex);
  return newFile;
};

// ======================================================================

const writeCustomHighlighterCreation = (
  oldFile: string,
  chalkVar: string,
  highlighters: InputPatternHighlighter[]
): string | null => {
  // Pattern A (older CC): ,VAR=REACT.useMemo(()=>{let RANGES=[];if(...)RANGES.push(...)
  // Pattern B (CC 2.1.86+): let VAR=REACT.useMemo(()=>{let RANGES=[];for(...)...;if(...)RANGES.push(...)
  const regexA =
    /(,[$\w]+=[$\w]+\.useMemo\(\(\)=>\{let [$\w]+=\[\];)(if\([$\w]+&&[$\w]+&&![$\w]+\)([$\w]+)\.push\(\{start:[$\w]+,end:[$\w]+\+[$\w]+\.length,color:"warning",priority:\d+\})/;
  const regexB =
    /((?:let |,)[$\w]+=[$\w]+\.useMemo\(\(\)=>\{let [$\w]+=\[\];.{0,500}?)(if\([$\w]+&&[$\w]+&&![$\w]+\)([$\w]+)\.push\(\{start:[$\w]+,end:[$\w]+\+[$\w]+\.length,color:"warning",priority:\d+\})/;

  const match = oldFile.match(regexA) ?? oldFile.match(regexB);
  if (!match || match.index === undefined) {
    console.error(
      'patch: inputPatternHighlighters: failed to find useMemo/push pattern'
    );
    return null;
  }

  const rangesVar = match[3];

  const reactMemoPattern = /[^$\w]([$\w]+(?:\.default)?)\.useMemo\(/;
  const reactMemoMatch = match[1].match(reactMemoPattern);
  if (!reactMemoMatch) {
    console.error(
      'patch: inputPatternHighlighters: failed to extract React var from useMemo'
    );
    return null;
  }
  const reactVarFromMemo = reactMemoMatch[1];

  const searchStart = Math.max(0, match.index - 10000);
  const searchWindow = oldFile.slice(searchStart, match.index);
  const inputPattern = /\binput:([$\w]+),/g;
  const inputMatches = Array.from(searchWindow.matchAll(inputPattern));
  if (inputMatches.length === 0) {
    console.error(
      'patch: inputPatternHighlighters: failed to find input variable pattern'
    );
    return null;
  }
  const inputVar = inputMatches[inputMatches.length - 1][1];

  const isLetDecl = match[1].startsWith('let ');
  const memoPrefix = isLetDecl ? ';let ' : ',';

  let useMemoCode = '';
  for (let i = 0; i < highlighters.length; i++) {
    const highlighter = highlighters[i];
    let flags = highlighter.regexFlags;
    if (!flags.includes('g')) {
      flags += 'g';
    }
    const regex = new RegExp(highlighter.regex, flags);
    const regexStr = stringifyRegex(regex);

    useMemoCode += `${memoPrefix}matchedTweakccReplacements${i}=${reactVarFromMemo}.useMemo(()=>{return[...${inputVar}.matchAll(${regexStr})].map(m=>({start:m.index,end:m.index+m[0].length}))},[${inputVar}])`;
  }
  if (isLetDecl) useMemoCode += ';';

  let genCode = '';
  for (let i = 0; i < highlighters.length; i++) {
    const highlighter = highlighters[i];
    const chalkChain = buildChalkChain(chalkVar, highlighter);
    const formatStr = JSON.stringify(highlighter.format).replace(
      /\{MATCH\}/g,
      '"+x+"'
    );

    genCode += `for(let matchedTweakccReplacement of matchedTweakccReplacements${i}){${rangesVar}.push({start:matchedTweakccReplacement.start,end:matchedTweakccReplacement.end,color:x=>${chalkChain}(${formatStr}),priority:100})}`;
  }

  const replacement = match[1] + genCode + match[2];

  const beforeMatch = oldFile.slice(0, match.index);
  const afterMatch = oldFile.slice(match.index + match[0].length);

  const newFile = beforeMatch + useMemoCode + replacement + afterMatch;

  showDiff(
    oldFile,
    newFile,
    useMemoCode + replacement,
    match.index,
    match.index + match[0].length
  );

  return newFile;
};

// ======================================================================

export const writeInputPatternHighlighters = (
  oldFile: string,
  highlighters: InputPatternHighlighter[]
): string | null => {
  const enabledHighlighters = highlighters.filter(h => h.enabled);

  if (enabledHighlighters.length === 0) {
    return null;
  }

  const chalkVar = findChalkVar(oldFile);
  if (!chalkVar) {
    console.error(
      '^ patch: inputPatternHighlighters: failed to find chalk variable'
    );
    return null;
  }

  let newFile: string | null;

  newFile = writeCustomHighlighterImpl(oldFile);
  if (!newFile) {
    console.error(
      '^ patch: inputPatternHighlighters: writeCustomHighlighterImpl failed'
    );
    return null;
  }

  newFile = writeCustomHighlighterCreation(
    newFile,
    chalkVar,
    enabledHighlighters
  );
  if (!newFile) {
    console.error(
      '^ patch: inputPatternHighlighters: writeCustomHighlighterCreation failed'
    );
    return null;
  }

  return newFile;
};

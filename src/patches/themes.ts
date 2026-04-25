// Please see the note about writing patches in ./index

import { Theme } from '../types';
import { LocationResult, showDiff } from './index';

function getThemesLocation(oldFile: string): {
  switchStatement: LocationResult;
  objArr: LocationResult;
  obj: LocationResult;
} | null {
  // Look for switch statement pattern: switch(A){case"light":return ...;}
  const switchPattern =
    /switch\s*\(([^)]+)\)\s*\{[^}]*case\s*["']light["'][^}]+\}/s;
  const switchMatch = oldFile.match(switchPattern);

  if (!switchMatch || switchMatch.index == undefined) {
    console.error('patch: themes: failed to find switchMatch');
    return null;
  }

  const objArrPatterns = [
    /\[(?:(?:\.\.\.\[\])|(?:\.\.\.\(feature\("AUTO_THEME"\)\s*\?\s*\[\{label:"Auto \(match terminal\)",value:"auto"(?:\s+as const)?\}\]\s*:\s*\[\]\)))?,?\{label:"Dark mode",value:"dark"\},\{label:"Light mode",value:"light"\}(?:,\{label:"Dark mode \(colorblind-friendly\)",value:"dark-daltonized"\},\{label:"Light mode \(colorblind-friendly\)",value:"light-daltonized"\},\{label:"Dark mode \(ANSI colors only\)",value:"dark-ansi"\},\{label:"Light mode \(ANSI colors only\)",value:"light-ansi"\})?\]/,
    /\[(?:\{label:"Auto \(match terminal\)",value:"auto"\},)?\{label:"Dark mode",value:"dark"\},\{label:"Light mode",value:"light"\}(?:,\{label:"Dark mode \(colorblind-friendly\)",value:"dark-daltonized"\},\{label:"Light mode \(colorblind-friendly\)",value:"light-daltonized"\},\{label:"Dark mode \(ANSI colors only\)",value:"dark-ansi"\},\{label:"Light mode \(ANSI colors only\)",value:"light-ansi"\})?\]/,
    /\[\.\.\.[$\w]+,[$\w]+,[$\w]+,[$\w]+,[$\w]+,[$\w]+,[$\w]+,\.\.\.[$\w]+\.map\([$\w]+\),\.\.\.[$\w]+\]/,
  ];
  const objPat =
    /(?:return|[$\w]+=)\{auto:"Auto \(match terminal\)",dark:"Dark mode",light:"Light mode"(?:,"dark-daltonized":"Dark mode \(colorblind-friendly\)","light-daltonized":"Light mode \(colorblind-friendly\)","dark-ansi":"Dark mode \(ANSI colors only\)","light-ansi":"Light mode \(ANSI colors only\)")?\}/;
  const objArrMatch = objArrPatterns
    .map(pattern => oldFile.match(pattern))
    .find(
      (match): match is RegExpMatchArray => !!match && match.index !== undefined
    );
  const objMatch = oldFile.match(objPat);

  if (!objArrMatch || objArrMatch.index == undefined) {
    console.error('patch: themes: failed to find objArrMatch');
    return null;
  }

  if (!objMatch || objMatch.index == undefined) {
    console.error('patch: themes: failed to find objMatch');
    return null;
  }

  return {
    switchStatement: {
      startIndex: switchMatch.index,
      endIndex: switchMatch.index + switchMatch[0].length,
      identifiers: [switchMatch[1].trim()],
    },
    objArr: {
      startIndex: objArrMatch.index,
      endIndex: objArrMatch.index + objArrMatch[0].length,
    },
    obj: {
      startIndex: objMatch.index,
      endIndex: objMatch.index + objMatch[0].length,
    },
  };
}

export const writeThemes = (
  oldFile: string,
  themes: Theme[]
): string | null => {
  const locations = getThemesLocation(oldFile);
  if (!locations) {
    return null;
  }

  if (themes.length === 0) {
    return oldFile;
  }

  let newFile = oldFile;

  // Process in reverse order to avoid index shifting

  // Update theme mapping object (obj)
  const originalObj = oldFile.slice(
    locations.obj.startIndex,
    locations.obj.endIndex
  );
  const objPrefix = originalObj.startsWith('return')
    ? 'return'
    : originalObj.slice(0, originalObj.indexOf('{'));
  const obj =
    objPrefix +
    JSON.stringify(
      Object.fromEntries(themes.map(theme => [theme.id, theme.name]))
    );
  newFile =
    newFile.slice(0, locations.obj.startIndex) +
    obj +
    newFile.slice(locations.obj.endIndex);
  showDiff(
    oldFile,
    newFile,
    obj,
    locations.obj.startIndex,
    locations.obj.endIndex
  );
  oldFile = newFile;

  // Update theme options array (objArr)
  const objArr = JSON.stringify(
    themes.map(theme => ({ label: theme.name, value: theme.id }))
  );
  newFile =
    newFile.slice(0, locations.objArr.startIndex) +
    objArr +
    newFile.slice(locations.objArr.endIndex);
  showDiff(
    oldFile,
    newFile,
    objArr,
    locations.objArr.startIndex,
    locations.objArr.endIndex
  );
  oldFile = newFile;

  // Update switch statement
  let switchStatement = `switch(${locations.switchStatement.identifiers?.[0]}){\n`;
  themes.forEach(theme => {
    switchStatement += `case"${theme.id}":return${JSON.stringify(
      theme.colors
    )};\n`;
  });
  switchStatement += `default:return${JSON.stringify(themes[0].colors)};\n}`;

  newFile =
    newFile.slice(0, locations.switchStatement.startIndex) +
    switchStatement +
    newFile.slice(locations.switchStatement.endIndex);
  showDiff(
    oldFile,
    newFile,
    switchStatement,
    locations.switchStatement.startIndex,
    locations.switchStatement.endIndex
  );

  return newFile;
};

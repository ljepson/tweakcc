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

  const themePickerAnchor = oldFile.indexOf(
    'ZA("theme:toggleSyntaxHighlighting"'
  );
  const settingsThemeAnchor = oldFile.indexOf('.id==="theme"?');

  let objArrMatch: RegExpMatchArray | null = null;
  let objArrStart = -1;
  if (themePickerAnchor !== -1) {
    const themePickerSlice = oldFile.slice(
      themePickerAnchor,
      themePickerAnchor + 2500
    );
    const match = themePickerSlice.match(
      /\[(?:\.{3}\[\],)?(?:\{label:"(?:Dark|Light).+?",value:".+?"\},?)+\]/
    );
    if (match && match.index !== undefined) {
      objArrMatch = match;
      objArrStart = themePickerAnchor + match.index;
    }
  }

  let objMatch: RegExpMatchArray | null = null;
  let objStart = -1;
  if (settingsThemeAnchor !== -1) {
    const settingsThemeSlice = oldFile.slice(
      settingsThemeAnchor,
      settingsThemeAnchor + 800
    );
    const match = settingsThemeSlice.match(
      /return\{(?:[$\w-]+?:"(?:Auto|Dark|Light).+?",?)+\}/
    );
    if (match && match.index !== undefined) {
      objMatch = match;
      objStart = settingsThemeAnchor + match.index;
    }
  }

  if (!objArrMatch || objArrStart === -1) {
    console.error('patch: themes: failed to find objArrMatch');
    return null;
  }

  if (!objMatch || objStart === -1) {
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
      startIndex: objArrStart,
      endIndex: objArrStart + objArrMatch[0].length,
    },
    obj: {
      startIndex: objStart,
      endIndex: objStart + objMatch[0].length,
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
  const obj =
    'return' +
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

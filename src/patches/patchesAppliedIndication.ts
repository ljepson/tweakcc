import {
  LocationResult,
  escapeIdent,
  findBoxComponent,
  findChalkVar,
  findTextComponent,
  getReactVar,
  showDiff,
} from './index';

/**
 * PATCH 1: Finds the location of the version output pattern in Claude Code's cli.js
 */
export const findVersionOutputLocation = (
  fileContents: string
): LocationResult | null => {
  // Pattern: }.VERSION} (Claude Code)
  const versionPattern = '}.VERSION} (Claude Code)';
  const versionIndex = fileContents.indexOf(versionPattern);
  if (versionIndex == -1) {
    console.error(
      'patch: patchesAppliedIndication: failed to find versionIndex'
    );
    return null;
  }

  return {
    startIndex: 0,
    endIndex: versionIndex + versionPattern.length,
  };
};

/**
 * PATCH 2: Finds the location to insert tweakcc version in the header
 */
const findTweakccVersionLocation = (
  fileContents: string
): LocationResult | null => {
  const patterns = [
    /[^$\w]([$\w]+)\.createElement\(([$\w]+),\{bold:!0\},"Claude Code"\)," ",([$\w]+)\.createElement\(([$\w]+),\{dimColor:!0\},"v",[$\w]+\)/,
    /([$\w]+)\.createElement\(([$\w]+),null,([$\w]+)," ",\1\.createElement\(\2,\{dimColor:!0\},"v",[$\w]+\)\)/,
  ];

  for (const pattern of patterns) {
    const match = fileContents.match(pattern);
    if (!match || match.index === undefined) {
      continue;
    }

    if (
      pattern === patterns[1] &&
      !fileContents
        .slice(Math.max(0, match.index - 400), match.index + match[0].length)
        .includes('"Claude Code"')
    ) {
      continue;
    }

    // Insert before the closing paren of the version row createElement call.
    const insertIndex = match.index + match[0].length - 1;
    return {
      startIndex: insertIndex,
      endIndex: insertIndex,
    };
  }

  if (fileContents.includes('+ tweakcc v')) {
    return {
      startIndex: 0,
      endIndex: 0,
    };
  }

  {
    console.error(
      'patch: patchesAppliedIndication: failed to find Claude Code version pattern'
    );
    return null;
  }
};

/**
 * PATCH 4: Inserts tweakcc version in the indicator view
 * Returns the modified content and the position where the closing paren was added
 */
const applyIndicatorViewPatch = (
  fileContents: string,
  tweakccVersion: string,
  reactVar: string,
  boxComponent: string,
  textComponent: string,
  chalkVar: string
): { content: string; closingParenIndex: number } | null => {
  // 1. Find alignItems:"center",minHeight:<value>, where value can be a number or ternary
  const alignItemsPattern =
    /alignItems:"center",minHeight:([$\w]+\?\d+:\d+|\d+),?/;
  const alignItemsMatch = fileContents.match(alignItemsPattern);
  if (!alignItemsMatch || alignItemsMatch.index === undefined) {
    console.error(
      'patch: patchesAppliedIndication: failed to find alignItems pattern for PATCH 4'
    );
    return null;
  }

  // 2. Replace alignItems:"center",minHeight:<value>, with just minHeight:<value>,
  const minHeightValue = alignItemsMatch[1];
  let content =
    fileContents.slice(0, alignItemsMatch.index) +
    `minHeight:${minHeightValue},` +
    fileContents.slice(alignItemsMatch.index + alignItemsMatch[0].length);

  // 3. Go back 200 chars from the alignItems location
  const lookbackStart = Math.max(0, alignItemsMatch.index - 200);
  const lookbackSubstring = content.slice(
    lookbackStart,
    alignItemsMatch.index + 'minHeight:9,'.length + '},'.length
  );

  // 4. Find the LAST createElement call in that subsection to get the insertion point
  const createElementPattern =
    /[^$\w]([$\w]+)\.createElement\(([$\w]+),(?:\w+|\{[^}]+\}),/g;
  const matches = Array.from(lookbackSubstring.matchAll(createElementPattern));
  if (matches.length === 0) {
    console.error(
      'patch: patchesAppliedIndication: failed to find createElement for PATCH 4'
    );
    return null;
  }

  const lastMatch = matches[matches.length - 1];

  // Calculate the absolute position after the createElement call
  const matchPositionInFile =
    lookbackStart + lastMatch.index! + lastMatch[0].length;

  // 5. Insert the tweakcc version code after the createElement call
  const insertCode = `${reactVar}.createElement(${textComponent}, null, ${chalkVar}.blue.bold("     + tweakcc v${tweakccVersion}")),${reactVar}.createElement(${boxComponent},{alignItems:"center",flexDirection:"column"},`;

  const oldContent = content;
  content =
    content.slice(0, matchPositionInFile) +
    insertCode +
    content.slice(matchPositionInFile);

  showDiff(
    oldContent,
    content,
    insertCode,
    matchPositionInFile,
    matchPositionInFile
  );

  // 6. Use stack machine to find where to add the closing paren
  let level = 1;
  let currentIndex = matchPositionInFile + insertCode.length;
  let closingParenIndex = -1;

  while (currentIndex < content.length) {
    const ch = content[currentIndex];
    if (ch === '(') {
      level++;
    } else if (ch === ')') {
      if (level === 1) {
        // Found the location - this is where we add the closing paren
        closingParenIndex = currentIndex;
        break;
      }
      level--;
    }
    currentIndex++;
  }

  if (closingParenIndex === -1) {
    console.error(
      'patch: patchesAppliedIndication: failed to find closing paren for PATCH 4'
    );
    return null;
  }

  // 7. Add ")," at the location
  const oldContent2 = content;
  content =
    content.slice(0, closingParenIndex) +
    '),' +
    content.slice(closingParenIndex);

  showDiff(oldContent2, content, '),', closingParenIndex, closingParenIndex);

  return { content, closingParenIndex: closingParenIndex + 2 }; // +2 for the added "),"
};

/**
 * PATCH 5: Inserts patches applied list in the indicator view
 * Uses stack machine starting at level 2 to find insertion point
 */
const applyIndicatorPatchesListPatch = (
  fileContents: string,
  startIndex: number,
  reactVar: string,
  boxComponent: string,
  textComponent: string,
  chalkVar: string,
  patchesApplies: string[]
): string | null => {
  // Start stack machine at level = 5
  let level = 4; // This right at the very end of the header component, right after the debug banner.
  let currentIndex = startIndex;
  let insertionIndex = -1;

  while (currentIndex < fileContents.length) {
    const ch = fileContents[currentIndex];
    if (ch === '(') {
      level++;
    } else if (ch === ')') {
      if (level === 1) {
        // Found the location - this is where we add the patches list
        insertionIndex = currentIndex;
        break;
      }
      level--;
    }
    currentIndex++;
  }

  if (insertionIndex === -1) {
    console.error(
      'patch: patchesAppliedIndication: failed to find insertion point for PATCH 5'
    );
    return null;
  }

  // Build the patches applied list (same format as PATCH 3)
  const lines = [];
  lines.push(
    `,${reactVar}.createElement(${boxComponent}, { flexDirection: "column" },`
  );
  lines.push(
    `${reactVar}.createElement(${boxComponent}, null, ${reactVar}.createElement(${textComponent}, {color: "success", bold: true}, "┃ "), ${reactVar}.createElement(${textComponent}, {color: "success", bold: true}, "✓ tweakcc patches are applied")),`
  );
  for (let item of patchesApplies) {
    item = item.replace('CHALK_VAR', chalkVar);
    lines.push(
      `${reactVar}.createElement(${boxComponent}, null, ${reactVar}.createElement(${textComponent}, {color: "success", bold: true}, "┃ "), ${reactVar}.createElement(${textComponent}, {dimColor: true}, \`  * ${item}\`)),`
    );
  }
  lines.push('),');
  const patchesListCode = lines.join('');

  // Insert at the found location
  const oldContent = fileContents;
  const content =
    fileContents.slice(0, insertionIndex) +
    patchesListCode +
    fileContents.slice(insertionIndex);

  showDiff(
    oldContent,
    content,
    patchesListCode,
    insertionIndex,
    insertionIndex
  );

  return content;
};

/**
 * PATCH 3: Finds the location to insert the patches applied list
 */
const findPatchesListLocation = (
  fileContents: string
): LocationResult | null => {
  if (fileContents.includes('✓ tweakcc patches are applied')) {
    return {
      startIndex: 0,
      endIndex: 0,
    };
  }

  const versionDisplayLoc = findTweakccVersionLocation(fileContents);
  if (!versionDisplayLoc) {
    return null;
  }

  // 2. Go back 1500 chars from the version display
  const lookbackStart = Math.max(0, versionDisplayLoc.startIndex - 1500);
  const lookbackSubstring = fileContents.slice(
    lookbackStart,
    versionDisplayLoc.startIndex
  );

  // 3. Take the last `}function ([$\w]+)\(`
  const functionPattern = /\}function ([$\w]+)\(/g;
  const functionMatches = Array.from(
    lookbackSubstring.matchAll(functionPattern)
  );
  if (functionMatches.length === 0) {
    return null;
  }
  const lastFunctionMatch = functionMatches[functionMatches.length - 1];
  const headerComponentName = lastFunctionMatch[1];

  // 4. Search for the createElement call with the header component
  const createHeaderPattern = new RegExp(
    `[^$\\w]([$\\w]+)\\.createElement\\(${escapeIdent(headerComponentName)},null\\),?`
  );
  const createHeaderMatch = fileContents.match(createHeaderPattern);
  if (!createHeaderMatch || createHeaderMatch.index === undefined) {
    return null;
  }

  // 5. Insert after this line
  const insertIndex = createHeaderMatch.index + createHeaderMatch[0].length;
  return {
    startIndex: insertIndex,
    endIndex: insertIndex,
  };
};

/**
 * Modifies the CLI to show patches applied indication
 * - PATCH 1: Modifies version output text
 * - PATCH 2: Adds tweakcc version to header
 * - PATCH 3: Adds patches applied list
 */
export const writePatchesAppliedIndication = (
  fileContents: string,
  tweakccVersion: string,
  patchesApplies: string[],
  showTweakccVersion: boolean = true,
  showPatchesApplied: boolean = true
): string | null => {
  const hasCliVersionMarker = fileContents.includes('(Claude Code)\\n');
  const hasTweakccCliVersion = fileContents.includes(
    `${tweakccVersion} (tweakcc)`
  );

  // PATCH 1: Version output modification
  let content = fileContents;
  if (!hasTweakccCliVersion) {
    const versionOutputLocation = findVersionOutputLocation(fileContents);
    if (!versionOutputLocation) {
      return fileContents;
    }

    const newText = `\\n${tweakccVersion} (tweakcc)`;
    content =
      fileContents.slice(0, versionOutputLocation.endIndex) +
      newText +
      fileContents.slice(versionOutputLocation.endIndex);

    showDiff(
      fileContents,
      content,
      newText,
      versionOutputLocation.endIndex,
      versionOutputLocation.endIndex
    );
  } else if (!hasCliVersionMarker) {
    return null;
  }

  // Find shared components needed by multiple patches
  const chalkVar = findChalkVar(fileContents);
  if (!chalkVar) {
    return fileContents;
  }

  const textComponent = findTextComponent(fileContents);
  if (!textComponent) {
    return fileContents;
  }

  const reactVar = getReactVar(fileContents);
  if (!reactVar) {
    return fileContents;
  }

  const boxComponent = findBoxComponent(fileContents);
  if (!boxComponent) {
    return fileContents;
  }

  // PATCH 2: Add tweakcc version to header (if enabled)
  if (showTweakccVersion && !content.includes('+ tweakcc v')) {
    const tweakccVersionLoc = findTweakccVersionLocation(content);
    if (!tweakccVersionLoc) {
      // This header fragment drifts often; patch 4 still adds the same version
      // marker in the startup indicator, so do not fail the whole patch.
      console.warn(
        'patch: patchesAppliedIndication: header version insertion skipped'
      );
    } else {
      const tweakccVersionCode = `, " ",${reactVar}.createElement(${textComponent}, null, ${chalkVar}.blue.bold('+ tweakcc v${tweakccVersion}'))`;

      const oldContent2 = content;
      content =
        content.slice(0, tweakccVersionLoc.startIndex) +
        tweakccVersionCode +
        content.slice(tweakccVersionLoc.endIndex);

      showDiff(
        oldContent2,
        content,
        tweakccVersionCode,
        tweakccVersionLoc.startIndex,
        tweakccVersionLoc.endIndex
      );
    }
  }

  // PATCH 3: Add patches applied list (if enabled)
  if (
    showPatchesApplied &&
    !content.includes('✓ tweakcc patches are applied')
  ) {
    const patchesListLoc = findPatchesListLocation(content);
    if (!patchesListLoc) {
      console.warn(
        'patch: patchesAppliedIndication: header patch list insertion skipped'
      );
    } else {
      const lines = [];
      lines.push(
        `${reactVar}.createElement(${boxComponent}, { flexDirection: "column" },`
      );
      lines.push(
        `${reactVar}.createElement(${boxComponent}, null, ${reactVar}.createElement(${textComponent}, {color: "success", bold: true}, "┃ "), ${reactVar}.createElement(${textComponent}, {color: "success", bold: true}, "✓ tweakcc patches are applied")),`
      );
      for (let item of patchesApplies) {
        item = item.replace('CHALK_VAR', chalkVar);
        lines.push(
          `${reactVar}.createElement(${boxComponent}, null, ${reactVar}.createElement(${textComponent}, {color: "success", bold: true}, "┃ "), ${reactVar}.createElement(${textComponent}, {dimColor: true}, \`  * ${item}\`)),`
        );
      }
      lines.push('),');
      const patchesListCode = lines.join('\n');

      const oldContent3 = content;
      content =
        content.slice(0, patchesListLoc.startIndex) +
        patchesListCode +
        content.slice(patchesListLoc.endIndex);

      showDiff(
        oldContent3,
        content,
        patchesListCode,
        patchesListLoc.startIndex,
        patchesListLoc.endIndex
      );
    }
  }

  // PATCH 4: Add tweakcc version to indicator view (if enabled)
  let patch4ClosingParenIndex = -1;
  if (showTweakccVersion) {
    const patch4Result = applyIndicatorViewPatch(
      content,
      tweakccVersion,
      reactVar,
      boxComponent,
      textComponent,
      chalkVar
    );
    if (!patch4Result) {
      console.warn(
        'patch: patchesAppliedIndication: indicator version insertion skipped'
      );
    } else {
      content = patch4Result.content;
      patch4ClosingParenIndex = patch4Result.closingParenIndex;
    }
  }

  // PATCH 5: Add patches applied list to indicator view (if enabled)
  if (showPatchesApplied) {
    // If patch 4 wasn't applied, we need to find the insertion point
    if (patch4ClosingParenIndex === -1) {
      // Find alignItems:"center",minHeight:<value>, to use as reference point
      const alignItemsPattern =
        /alignItems:"center",minHeight:([$\w]+\?\d+:\d+|\d+),?/;
      const alignItemsMatch = content.match(alignItemsPattern);
      if (!alignItemsMatch || alignItemsMatch.index === undefined) {
        console.error(
          'patch: patchesAppliedIndication: failed to find reference point for PATCH 5'
        );
        return null;
      }
      patch4ClosingParenIndex =
        alignItemsMatch.index + alignItemsMatch[0].length;
    }

    const finalContent = applyIndicatorPatchesListPatch(
      content,
      patch4ClosingParenIndex,
      reactVar,
      boxComponent,
      textComponent,
      chalkVar,
      patchesApplies
    );
    if (!finalContent) {
      console.warn(
        'patch: patchesAppliedIndication: indicator patch list insertion skipped'
      );
    } else {
      content = finalContent;
    }
  }

  return content;
};

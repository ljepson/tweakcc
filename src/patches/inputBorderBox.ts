// Please see the note about writing patches in ./index

import { LocationResult, showDiff } from './index';

const getInputBoxBorderLocation = (oldFile: string): LocationResult | null => {
  const bashIndex = oldFile.indexOf('bash:"bashBorder"');
  if (bashIndex === -1) {
    console.error('patch: input border: failed to find bash pattern');
    return null;
  }

  const searchSection = oldFile.slice(bashIndex, bashIndex + 500);
  const borderStylePattern = /borderStyle:"[^"]*"/;
  const borderStyleMatch = searchSection.match(borderStylePattern);

  if (!borderStyleMatch || borderStyleMatch.index === undefined) {
    console.error('patch: input border: failed to find border style pattern');
    return null;
  }

  return {
    startIndex: bashIndex + borderStyleMatch.index,
    endIndex: bashIndex + borderStyleMatch.index + borderStyleMatch[0].length,
  };
};

/**
 * Removes the input box border in Claude Code's PromptInput component.
 *
 * The PromptInput renders the input area in a ternary:
 *   swarmBanner ? (Fragment with ─.repeat lines using .bgColor) : (Box with borderStyle:"round" and borderText:)
 *
 * There's also an isExternalEditorActive path with borderStyle:"round" and "Save and close editor".
 *
 * We patch:
 * 1. The bgColor ─.repeat top and bottom lines → empty strings
 * 2. The main input Box's borderStyle:"round" → borderStyle:undefined (identified by borderText:)
 * 3. The external editor Box's borderStyle:"round" → borderStyle:undefined (identified by "Save and close editor")
 */
export const writeInputBoxBorder = (
  oldFile: string,
  removeBorder: boolean
): string | null => {
  if (!removeBorder || oldFile.includes('borderColor:undefined')) {
    return oldFile;
  }

  let content = oldFile;
  let patched = false;

  const bottomBorderPattern =
    /createElement\(([$\w]+),\{color:([$\w]+)\.bgColor\},"─"\.repeat\(([$\w]+)\)\)/;
  const bottomMatch = content.match(bottomBorderPattern);
  if (bottomMatch) {
    const textComp = bottomMatch[1];
    content = content.replace(
      bottomMatch[0],
      `createElement(${textComp},null,"")`
    );

    // Top border: createElement(Text,{color:VAR.bgColor},VAR.text?...Fragment..."─".repeat(...)..."──"):"─".repeat(VAR))
    const topBorderPattern = new RegExp(
      `createElement\\(${textComp},\\{color:${bottomMatch[2]}\\.bgColor\\},${bottomMatch[2]}\\.text\\?.+?"─"\\.repeat\\(${bottomMatch[3]}\\)\\)`
    );
    const topMatch = content.match(topBorderPattern);
    if (topMatch) {
      content = content.replace(
        topMatch[0],
        `createElement(${textComp},null,"")`
      );
    }
    patched = true;
  }

  const mainInputPattern =
    /(borderColor:[$\w]+\(\),)borderStyle:"round"(,borderLeft:!1,borderRight:!1,borderBottom:!0,width:"100%",borderText:)/;
  const mainInputMatch = content.match(mainInputPattern);
  if (mainInputMatch) {
    content = content.replace(
      mainInputMatch[0],
      `${mainInputMatch[1]}borderStyle:undefined${mainInputMatch[2]}`
    );
    patched = true;
  }

  const editorPattern =
    /borderStyle:"round"(,borderLeft:!1,borderRight:!1,borderBottom:!0,width:"100%"\}.+?Save and close editor)/;
  const editorMatch = content.match(editorPattern);
  if (editorMatch) {
    content = content.replace(
      editorMatch[0],
      `borderStyle:undefined${editorMatch[1]}`
    );
    patched = true;
  }

  if (patched) {
    showDiff(oldFile, content, '(input border removed)', 0, 0);
    return content;
  }

  const location = getInputBoxBorderLocation(oldFile);
  if (!location) {
    console.error('patch: input border: failed to find input border pattern');
    return null;
  }

  const newProp = 'borderColor:undefined';

  const newFile =
    oldFile.slice(0, location.startIndex) +
    newProp +
    oldFile.slice(location.endIndex);

  showDiff(oldFile, newFile, newProp, location.startIndex, location.endIndex);

  return newFile;
};

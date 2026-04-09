import { showDiff } from './index';

export const writeFilterEmptyBridgeMessages = (
  oldFile: string
): string | null => {
  const alreadyPatchedPattern =
    /onInboundMessage\([$\w]+\)\{let [$\w]+=[$\w]+\([$\w]+\);if\(![$\w]+\)return;let\{content:([$\w]+),uuid:[$\w]+\}=[$\w]+(?:,[$\w]+=void 0)?;if\(typeof \1!=="string"\|\|\1\.trim\(\)===""\)return;/;

  if (alreadyPatchedPattern.test(oldFile)) {
    return oldFile;
  }

  const pattern =
    /onInboundMessage\([$\w]+\)\{let [$\w]+=[$\w]+\([$\w]+\);if\(![$\w]+\)return;let\{content:([$\w]+),uuid:[$\w]+\}=[$\w]+(?:,[$\w]+=void 0)?;/;
  const match = oldFile.match(pattern);

  if (!match || match.index === undefined) {
    console.error(
      'patch: filterEmptyBridgeMessages: failed to find inbound bridge message handler'
    );
    return null;
  }

  const contentVar = match[1];
  const insertIndex = match.index + match[0].length;
  const insertion = `if(typeof ${contentVar}!=="string"||${contentVar}.trim()==="")return;`;
  const newFile =
    oldFile.slice(0, insertIndex) + insertion + oldFile.slice(insertIndex);

  showDiff(oldFile, newFile, insertion, insertIndex, insertIndex);
  return newFile;
};

export const writeContinueResumeCompat212120 = (
  oldFile: string
): string | null => {
  const broken =
    'function RW4(H){return{onBeforeQuery:async()=>!0,onTurnComplete:async()=>{},render:()=>null}}';
  const fixed =
    'function RW4(H){return{onBeforeQuery:async()=>!0,onTurnComplete:async()=>{},onSessionRestored:()=>{},render:()=>null,ownsInput:!1}}';

  if (oldFile.includes(fixed)) {
    return oldFile;
  }

  if (!oldFile.includes(broken)) {
    return oldFile;
  }

  return oldFile.replace(broken, fixed);
};

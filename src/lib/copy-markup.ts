// Parses a "**bold**"-marked string into plain-text/bold runs for display.
// Pure function, no server dependencies — used both server-side (content.ts
// doesn't need it directly, but pages might) and client-side (Editable.tsx).
export type CopyRun = { text: string; bold: boolean };

export function parseCopyMarkup(value: string): CopyRun[] {
  const runs: CopyRun[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    if (m.index > last) runs.push({ text: value.slice(last, m.index), bold: false });
    runs.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < value.length) runs.push({ text: value.slice(last), bold: false });
  return runs;
}

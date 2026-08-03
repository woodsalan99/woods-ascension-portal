// Parses the two emphasis markers registry copy may use, into runs for
// display. Pure function, no server dependencies — used both server-side
// and client-side (Editable.tsx).
//
//   **like this**  → the gold accent. On the thesis block this renders gold
//                    and italic, which is what makes the campaign's moving
//                    parts stand out from the sentence around them.
//   __like this__  → genuinely bold. Body colour, heavier weight, for the
//                    phrase that opens a paragraph.
//
// Two markers rather than one because "**" was already doing the gold job
// everywhere, and a second, plainer emphasis was needed for lead-ins like
// "The core things I need from you:". See D40.
export type CopyRun = { text: string; bold: boolean; strong?: boolean };

export function parseCopyMarkup(value: string): CopyRun[] {
  const runs: CopyRun[] = [];
  const re = /\*\*(.+?)\*\*|__(.+?)__/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    if (m.index > last) runs.push({ text: value.slice(last, m.index), bold: false });
    if (m[1] !== undefined) runs.push({ text: m[1], bold: true });
    else runs.push({ text: m[2], bold: false, strong: true });
    last = m.index + m[0].length;
  }
  if (last < value.length) runs.push({ text: value.slice(last), bold: false });
  return runs;
}

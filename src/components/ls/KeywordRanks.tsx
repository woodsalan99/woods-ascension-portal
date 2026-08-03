// Where you sit in Google's normal results, per search term.
//
// The old version showed a bare number in a circle — "5" — which says
// nothing on its own: 5 out of what, and is that good? A homeowner scrolls
// a page of ten results, so what actually matters is which page you're on
// and how far down. That's what this shows, in words first and a position
// track second. See D46.
export type KeywordRankVM = {
  id: string;
  keyword: string;
  position: number;
  prevPosition: number | null;
  volume: number | null;
};

// Google shows ten results a page, so position maps to something a person
// can picture: the first three are what nearly everyone clicks.
function placeInWords(position: number): { text: string; zone: "top" | "page1" | "page2" | "beyond" } {
  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
  };
  if (position <= 3) return { text: `${ordinal(position)} result on page 1 — right where people look`, zone: "top" };
  if (position <= 10) return { text: `${ordinal(position)} result on page 1`, zone: "page1" };
  if (position <= 20) return { text: `${ordinal(position - 10)} result on page 2`, zone: "page2" };
  return { text: `Page ${Math.ceil(position / 10)} — too far back to get seen`, zone: "beyond" };
}

export function KeywordRanks({ keywords }: { keywords: KeywordRankVM[] }) {
  // The track runs 1 → 20; past that there's nothing useful to show.
  const TRACK_MAX = 20;

  return (
    <div className="wa-kw-ranks">
      {keywords.map((k) => {
        const place = placeInWords(k.position);
        const moved = k.prevPosition !== null ? k.prevPosition - k.position : null;
        const pct = Math.min(100, ((TRACK_MAX - Math.min(k.position, TRACK_MAX)) / (TRACK_MAX - 1)) * 100);

        return (
          <div key={k.id} className="wa-kw-rank">
            <div className="wa-kw-rank-head">
              <b>&ldquo;{k.keyword}&rdquo;</b>
              {moved !== null && moved !== 0 && (
                <span className={`wa-kwrank-move ${moved > 0 ? "up" : "down"}`}>
                  {moved > 0 ? `↑ up ${moved}` : `↓ down ${Math.abs(moved)}`} since last month
                </span>
              )}
            </div>

            <div className={`wa-kw-place ${place.zone}`}>{place.text}</div>

            <div className="wa-kw-track" aria-hidden>
              <div className="wa-kw-track-zones">
                <span className="top" />
                <span className="page1" />
                <span className="page2" />
              </div>
              <span className="wa-kw-marker" style={{ left: `${pct}%` }} />
            </div>
            <div className="wa-kw-scale" aria-hidden>
              <span>Further back</span>
              <span>Top of page 1</span>
            </div>

            <div className="wa-kw-volume">
              {k.volume
                ? `About ${k.volume.toLocaleString("en-US")} people search this on Oahu each month`
                : "Search volume not reported for this one"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

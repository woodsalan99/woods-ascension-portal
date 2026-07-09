import { Play } from "./icons";

// D9: render Loom/YouTube as embeds, any other URL as a styled link card.
function resolveVideoEmbed(url: string): { embedUrl: string } | null {
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomMatch) {
    return { embedUrl: `https://www.loom.com/embed/${loomMatch[1]}` };
  }
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/,
  );
  if (ytMatch) {
    return { embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }
  return null;
}

export function AlanNote({
  headline,
  body,
  videoUrl,
}: {
  headline: string;
  body: string;
  videoUrl: string | null;
}) {
  const embed = videoUrl ? resolveVideoEmbed(videoUrl) : null;

  return (
    <div className="wa-note-row">
      <div className="wa-card wa-note-video">
        {embed ? (
          <div className="wa-video-embed">
            <iframe src={embed.embedUrl} allow="autoplay; fullscreen" allowFullScreen title="Weekly update video" />
          </div>
        ) : videoUrl ? (
          <a
            className="wa-note-link-card"
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Play /> Watch the update
          </a>
        ) : (
          <div className="wa-video-thumb">
            <div className="wa-video-grain" />
            <div className="wa-video-meta">No video attached this week</div>
          </div>
        )}
      </div>
      <div className="wa-card wa-note-text">
        <div className="wa-eyebrow">A note from Alan</div>
        <h3 className="wa-note-h">{headline}</h3>
        <p className="wa-note-p">{body}</p>
        <div className="wa-note-sig">— Alan · Woods Ascension</div>
      </div>
    </div>
  );
}

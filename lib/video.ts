// Story video links. Admins paste a YouTube or Vimeo URL; the story page shows
// a thumbnail and loads the real player only when someone taps play (no
// third-party script or iframe on page load). Pure and client-safe.

export type VideoRef = {
  provider: "youtube" | "vimeo";
  id: string;
  /** Player URL, loaded only after a tap. YouTube uses the no-cookie domain. */
  embedUrl: string;
  /** Poster frame when the provider exposes one without an API call (YouTube). */
  thumbnailUrl: string | null;
  /** Where "watch on YouTube/Vimeo" should go. */
  watchUrl: string;
};

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseVideoUrl(raw: string | null | undefined): VideoRef | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "").toLowerCase();

  let ytId: string | null = null;
  if (host === "youtu.be") ytId = url.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") ytId = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      ytId = m ? m[1] : null;
    }
  }
  if (ytId && YT_ID.test(ytId)) {
    return {
      provider: "youtube",
      id: ytId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&playsinline=1`,
      thumbnailUrl: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      watchUrl: `https://www.youtube.com/watch?v=${ytId}`,
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = url.pathname.match(/^\/(?:video\/)?(\d{6,12})(?:\/([0-9a-f]{6,20}))?/);
    if (m) {
      const hash = m[2] ?? url.searchParams.get("h");
      const h = hash && /^[0-9a-f]{6,20}$/.test(hash) ? `&h=${hash}` : "";
      return {
        provider: "vimeo",
        id: m[1],
        embedUrl: `https://player.vimeo.com/video/${m[1]}?autoplay=1&dnt=1${h}`,
        thumbnailUrl: null,
        watchUrl: `https://vimeo.com/${m[1]}${hash ? `/${hash}` : ""}`,
      };
    }
  }
  return null;
}

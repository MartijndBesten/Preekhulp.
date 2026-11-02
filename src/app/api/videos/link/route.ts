// YouTube-link herkennen zonder API-sleutel: video-id, titel/kanaal via het openbare oEmbed-eindpunt (als bereikbaar)
// en of er al een transcript in de eigen bibliotheek staat. Haalt nooit ondertitels of inhoud op.
import { ApiFout, route } from "@/lib/api";
import { db } from "@/lib/db";
import { haalJson } from "@/lib/http/veilig";
import { GEEN_TRANSCRIPT, videoIdUitUrl } from "@/lib/videos/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return route(req, async () => {
    const invoer = (new URL(req.url).searchParams.get("url") ?? "").slice(0, 300);
    const vid = videoIdUitUrl(invoer);
    if (!vid) throw new ApiFout("Geen herkenbare YouTube-link of video-id.");
    const d = db();
    const url = `https://www.youtube.com/watch?v=${vid}`;
    let titel: string | null = null;
    let kanaal: string | null = null;
    let metaMelding: string | null = null;
    try {
      const j = await haalJson<{ title?: string; author_name?: string }>(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { db: d, dienst: "youtube-oembed", cacheSeconden: 7 * 24 * 3600, herhalingen: 0 });
      titel = j.title ?? null;
      kanaal = j.author_name ?? null;
    } catch (e) {
      metaMelding = `Titel niet opgehaald (${(e as Error).message.slice(0, 120)}); de link werkt wel.`;
    }
    const transcripten = d.prepare("SELECT id, titel, transcript_soort, gemaakt FROM documenten WHERE video_id = ? ORDER BY gemaakt DESC").all(vid);
    return { videoId: vid, url, titel, kanaal, metaMelding, transcripten, melding: transcripten.length ? null : GEEN_TRANSCRIPT };
  });
}

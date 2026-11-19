const cache = new Map<string, { data: any; expires: number }>();
const TTL = 10 * 60 * 1000;

export function getVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}

export async function fetchYoutubeVideos(ids: string[]): Promise<Record<string, any>> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY não configurada');

  const now = Date.now();
  const result: Record<string, any> = {};
  const missing: string[] = [];

  ids.forEach((id) => {
    const cached = cache.get(id);
    if (cached && cached.expires > now) result[id] = cached.data;
    else missing.push(id);
  });

  for (let i = 0; i < missing.length; i += 50) {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      id: missing.slice(i, i + 50).join(','),
      key,
      fields: 'items(id,snippet(title,description,channelTitle,publishedAt,thumbnails),statistics(viewCount))',
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error(`YouTube API respondeu ${response.status}`); // 👈 aqui

    const data: any = await response.json();
    data.items.forEach((item: any) => {
      result[item.id] = item;
      cache.set(item.id, { data: item, expires: now + TTL });
    });
  }

  return result;
}

export async function enrichVideos(rows: any[]) {
  const ids = Array.from(new Set(
    rows.map((r) => getVideoId(r.url ?? '')).filter(Boolean) as string[]
  ));

  let details: Record<string, any> = {};
  try {
    details = await fetchYoutubeVideos(ids);
  } catch (error) {
    console.log('Erro ao consultar o YouTube:', error);
  }

  return rows.map((r) => {
    const info = details[getVideoId(r.url ?? '') ?? ''];
    return {
      id: r.video_id,
      url: r.url,
      title: info?.snippet.title ?? r.title,
      channel: info?.snippet.channelTitle ?? null,
      viewCount: info?.statistics.viewCount ?? '0',
      publishedAt: info?.snippet.publishedAt ?? null,
      thumbnail: info?.snippet.thumbnails.high?.url ?? null,
    };
  });
}
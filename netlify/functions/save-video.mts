import resolveVideo from './download.mts';

export default async (request: Request) => {
  const fail = (message: string, status = 502) => Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return fail('Metode tidak didukung.', 405);
  try {
    // Resolve the original TikTok link ourselves; never accept arbitrary media URLs.
    const resolved = await resolveVideo(request);
    if (!resolved.ok) return resolved;
    const { video } = await resolved.json();
    const trusted = (value: string) => {
      const url = new URL(value);
      const domains = ['tikwm.com', 'tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'tiktok.com', 'tiktokv.com', 'byteoversea.com', 'ibytedtos.com', 'musical.ly'];
      if (url.protocol !== 'https:' || url.port || url.username || url.password || !domains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) throw new Error('Untrusted media');
      return url;
    };
    let url = trusted(video);
    let media: Response | undefined;
    const signal = AbortSignal.timeout(25000);
    for (let redirects = 0; redirects <= 3; redirects++) {
      media = await fetch(url, { redirect: 'manual', signal });
      if (![301, 302, 303, 307, 308].includes(media.status)) break;
      const location = media.headers.get('location');
      await media.body?.cancel();
      if (!location || redirects === 3) throw new Error('Invalid redirect');
      url = trusted(new URL(location, url).href);
    }
    if (!media?.ok || !media.body) return fail('File video belum tersedia. Coba proses ulang tautannya.');
    const type = media.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!['video/mp4', 'application/octet-stream', 'binary/octet-stream'].includes(type || '')) {
      await media.body.cancel();
      return fail('Layanan tidak mengirim file MP4 yang valid. Coba lagi nanti.');
    }
    // Stay below the platform streaming response limit, including its envelope.
    const limit = 19 * 1024 * 1024;
    if (Number(media.headers.get('content-length')) > limit) {
      await media.body.cancel();
      return fail('Video terlalu besar untuk unduhan langsung (maksimal 19 MB). Coba video yang lebih pendek.', 413);
    }
    let size = 0;
    const stream = media.body.pipeThrough(new TransformStream({
      transform(chunk, controller) {
        size += chunk.byteLength;
        if (size > limit) { controller.error(new Error('Video exceeds download limit')); return; }
        controller.enqueue(chunk);
      },
    }));
    return new Response(stream, { headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': 'attachment; filename="download-vt-HD-tnpa-wtrpark-by-MasTip.mp4"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return fail('Unduhan gagal atau layanan sedang sibuk. Silakan coba lagi.');
  }
};
export const config = { path: '/api/save-video' };

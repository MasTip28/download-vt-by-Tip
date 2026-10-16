export default async (request: Request) => {
  const reply = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return reply({ error: 'Metode tidak didukung.' }, 405);
  try {
    if (Number(request.headers.get('content-length')) > 4096) return reply({ error: 'Tautan terlalu panjang.' }, 413);
    const body = await request.text();
    if (body.length > 4096) return reply({ error: 'Tautan terlalu panjang.' }, 413);
    let input;
    try { input = JSON.parse(body); } catch { return reply({ error: 'Permintaan tidak valid.' }, 400); }
    let url: URL;
    try { url = new URL(input.url); } catch { return reply({ error: 'Masukkan tautan TikTok yang valid.' }, 400); }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !(url.hostname === 'tiktok.com' || url.hostname.endsWith('.tiktok.com')) || url.pathname === '/') {
      return reply({ error: 'Gunakan tautan video TikTok publik dengan HTTPS.' }, 400);
    }
    const upstream = await fetch('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url: url.href, hd: '1' }),
      signal: AbortSignal.timeout(25000),
    });
    if (!upstream.ok) return reply({ error: 'Layanan pemrosesan sedang sibuk. Coba lagi nanti.' }, 502);
    const payload = await upstream.json();
    const data = payload.data;
    const media = (value: unknown) => {
      if (typeof value !== 'string') return null;
      try { const parsed = new URL(value, 'https://www.tikwm.com'); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : null; } catch { return null; }
    };
    const video = media(data?.hdplay) || media(data?.play);
    if (payload.code !== 0 || !video) return reply({ error: 'Video tidak tersedia. Pastikan tautan benar dan video bersifat publik. Foto atau slideshow belum didukung.' }, 422);
    return reply({ title: String(data.title || '').slice(0, 1000), author: String(data.author?.nickname || '').slice(0, 150), video, audio: media(data.music), cover: media(data.cover) });
  } catch {
    return reply({ error: 'Video belum dapat diproses. Layanan mungkin sedang sibuk; coba beberapa saat lagi.' }, 502);
  }
};
export const config = { path: '/api/download' };

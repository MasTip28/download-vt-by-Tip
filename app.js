const form = document.querySelector('#download-form');
const input = document.querySelector('#video-url');
const submit = document.querySelector('#submit');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
function notify(message, error = false) {
  status.hidden = false;
  status.textContent = message;
  status.classList.toggle('error', error);
}
function isTikTok(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'tiktok.com' || url.hostname.endsWith('.tiktok.com')); } catch { return false; }
}
document.querySelector('#paste').addEventListener('click', async () => {
  try {
    input.value = (await navigator.clipboard.readText()).trim();
    input.focus();
    status.hidden = true;
  } catch { notify('Akses clipboard belum tersedia. Tekan lama kolom tautan atau gunakan Ctrl / Cmd + V untuk menempel.'); input.focus(); }
});
input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); status.hidden = true; result.hidden = true; document.querySelector('#preview').pause(); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  result.hidden = true;
  document.querySelector('#preview').pause();
  if (!isTikTok(input.value.trim())) {
    notify('Masukkan tautan TikTok yang valid, misalnya https://www.tiktok.com/@kreator/video/...', true);
    input.setAttribute('aria-invalid', 'true'); input.focus(); return;
  }
  submit.disabled = true;
  submit.querySelector('span').textContent = 'Memproses video...';
  form.setAttribute('aria-busy', 'true');
  notify('Sedang mencari video dan kualitas terbaik. Tunggu sebentar, ya.');
  try {
    const response = await fetch('/api/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: input.value.trim() }), signal: AbortSignal.timeout(35000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Video belum dapat diproses. Coba lagi nanti.');
    document.querySelector('#video-title').textContent = data.title || 'Momen favoritmu';
    document.querySelector('#creator').textContent = data.author ? `Oleh ${data.author}` : 'Video TikTok';
    const preview = document.querySelector('#preview');
    preview.src = data.video;
    preview.poster = data.cover || '';
    document.querySelector('#video-download').href = data.video;
    const audio = document.querySelector('#audio-download');
    audio.hidden = !data.audio;
    audio.removeAttribute('href');
    if (data.audio) audio.href = data.audio;
    result.hidden = false;
    notify('Berhasil! Video tanpa watermark siap kamu simpan.');
  } catch (error) {
    notify(error.name === 'TimeoutError' ? 'Pemrosesan terlalu lama. Silakan coba beberapa saat lagi.' : error instanceof TypeError ? 'Koneksi terputus. Periksa internet dan coba lagi.' : error.message, true);
  } finally {
    submit.disabled = false;
    submit.querySelector('span').textContent = 'Download video';
    form.removeAttribute('aria-busy');
  }
});

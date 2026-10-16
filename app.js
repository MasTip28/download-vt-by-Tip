const form = document.querySelector('#download-form');
const input = document.querySelector('#video-url');
const submit = document.querySelector('#submit');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const downloadButton = document.querySelector('#video-download');
const galleryButton = document.querySelector('#save-gallery');
let resolvedUrl = '';
let savedFile = null;
let downloadVersion = 0;
function clearDownload() {
  resolvedUrl = ''; savedFile = null; galleryButton.hidden = true; downloadVersion++;
}
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
    input.dispatchEvent(new Event('input'));
    input.focus();
    status.hidden = true;
  } catch { notify('Akses clipboard belum tersedia. Tekan lama kolom tautan atau gunakan Ctrl / Cmd + V untuk menempel.'); input.focus(); }
});
input.addEventListener('input', () => { clearDownload(); input.removeAttribute('aria-invalid'); status.hidden = true; result.hidden = true; document.querySelector('#preview').pause(); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  result.hidden = true;
  clearDownload();
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
    resolvedUrl = input.value.trim();
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

downloadButton.addEventListener('click', async () => {
  if (!resolvedUrl || downloadButton.disabled) return;
  const version = downloadVersion;
  downloadButton.disabled = true;
  downloadButton.textContent = 'Mengunduh...';
  notify('Sedang mengunduh file MP4. Halaman ini tetap terbuka.');
  try {
    const response = await fetch('/api/save-video', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: resolvedUrl }), signal: AbortSignal.timeout(55000),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Unduhan gagal. Coba lagi.');
    }
    const blob = await response.blob();
    if (!blob.size || !blob.type.startsWith('video/mp4')) throw new Error('File video tidak valid. Coba lagi.');
    if (version !== downloadVersion) return;
    savedFile = new File([blob], 'download-vt-HD-tnpa-wtrpark-by-MasTip.mp4', { type: 'video/mp4' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = savedFile.name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    galleryButton.hidden = !(navigator.canShare && navigator.canShare({ files: [savedFile] }));
    notify('File dikirim ke unduhan browser. Cek folder Download. Untuk galeri iPhone, pilih Bagikan → Simpan Video dari file unduhan.');
  } catch (error) {
    if (version === downloadVersion) notify(error.name === 'TimeoutError' ? 'Unduhan terlalu lama. Silakan coba lagi.' : error instanceof TypeError ? 'Unduhan terputus atau file terlalu besar (maks. 19 MB). Coba lagi.' : error.message, true);
  } finally {
    downloadButton.disabled = false;
    downloadButton.textContent = 'Unduh MP4';
  }
});
galleryButton.addEventListener('click', async () => {
  if (!savedFile) return;
  try {
    await navigator.share({ files: [savedFile] });
  } catch (error) {
    if (error.name !== 'AbortError') notify('Berbagi file tidak tersedia. Buka video di folder Download lalu pilih Bagikan atau Simpan Video.', true);
  }
});

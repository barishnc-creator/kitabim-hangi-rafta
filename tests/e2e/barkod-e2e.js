// Kamerayla barkod okuma.
// 1) Canlı kamera: gerçek kitap arkası fotoğrafından üretilen, hafif bulanık ve titreyen bir "kamera görüntüsü"
//    tarayıcıya sahte kamera olarak verilir; barkod kendiliğinden okunmalı. (ffmpeg gerekir; yoksa bu adım atlanır.)
// 2) Fotoğraftan okuma: barkod küçük, yanında bandrol var; düz ve yan çekilmiş hali okunmalı.
const { chromium } = require('playwright');
const path = require('path'), os = require('os'), fs = require('fs'), { execFileSync } = require('child_process');
const K = 'http://localhost:8765/';
const FOTO = path.join(__dirname, '../veri/kitap-arka.jpg');
const BEKLENEN = '9789944886666';

function sahteKamera() {
  const y4m = path.join(os.tmpdir(), 'khr-kamera.y4m');
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', FOTO, '-t', '4', '-r', '15', '-vf',
      // barkodun çevresini kırp, 1280×720 yap, bulanıklaştır, el titremesi gibi oynat
      "crop=iw*0.7:ih*0.21:iw*0.12:ih*0.44,scale=1280:720,gblur=sigma=2.2,crop=1240:700:'20+10*sin(t*7)':'10+8*cos(t*5)',scale=1280:720,format=yuv420p",
      y4m]);
    return y4m;
  } catch (e) { return null; }
}

(async () => {
  const h = [];
  let tamam = true;
  const y4m = sahteKamera();
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
  if (y4m) args.push('--use-file-for-fake-video-capture=' + y4m);
  const b = await chromium.launch({ args });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => h.push(e.message));
  await p.goto(K + 'index.html?yerel=1'); await p.waitForTimeout(500);

  if (y4m) {
    const t0 = Date.now();
    await p.click('#tara');
    const okundu = await p.waitForFunction(() => !document.querySelector('.kamera-perde'), null, { timeout: 20000 }).then(() => true, () => false);
    const deger = await p.inputValue('#sorgu');
    console.log('canlı kamera:', okundu ? deger + ' (' + (Date.now() - t0) + ' ms)' : 'OKUNAMADI', '| durum:', okundu ? '' : await p.textContent('#kamera-durum'));
    if (!deger.includes(BEKLENEN)) tamam = false;
    await p.fill('#sorgu', '');
    fs.unlinkSync(y4m);
  } else {
    console.log('canlı kamera: ffmpeg yok, atlandı');
  }

  await p.click('#tara');
  await p.setInputFiles('#kamera-foto', FOTO);
  await p.waitForFunction(() => !document.querySelector('.kamera-perde'), null, { timeout: 30000 }).catch(() => {});
  const foto = await p.inputValue('#sorgu');
  console.log('fotoğraftan:', foto);
  if (!foto.includes(BEKLENEN)) tamam = false;

  const yan = await p.evaluate(async () => {
    const r = await fetch('tests/veri/kitap-arka.jpg'); const img = await createImageBitmap(await r.blob());
    const c = document.createElement('canvas'); c.width = img.height; c.height = img.width;
    const x = c.getContext('2d'); x.translate(c.width, 0); x.rotate(Math.PI / 2); x.drawImage(img, 0, 0);
    const blob = await new Promise((t) => c.toBlob(t, 'image/jpeg', 0.85));
    try { return await Tarayici.fotoOku(new File([blob], 'yan.jpg', { type: 'image/jpeg' })); } catch (e) { return 'HATA ' + e.message; }
  });
  console.log('yan çekilmiş fotoğraf:', yan);
  if (yan !== BEKLENEN) tamam = false;

  console.log(tamam ? 'SONUÇ: geçti' : 'SONUÇ: BAŞARISIZ');
  console.log('hatalar:', h);
  await b.close();
  if (!tamam || h.length) process.exit(1);
})();

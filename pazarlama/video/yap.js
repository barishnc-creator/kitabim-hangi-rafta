// Videoyu kare kare çizip MP4'e döker.
// Kullanım (depo kökünde sunucu açıkken): node pazarlama/video/yap.js v|h [kare <saniye,...>]
// "ses" verilirse görüntü yeniden çizilmez, yalnız ses miksi yapılır. "kare" verilirse yalnız o anların PNG'leri çıkar (kontrol için).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const F = process.argv[2] === 'h' ? 'h' : 'v';
const W = F === 'v' ? 1080 : 1920, H = F === 'v' ? 1920 : 1080, FPS = 30;
const CIKTI = path.join(__dirname, 'cikti'); fs.mkdirSync(CIKTI, { recursive: true });
const MUZIK = process.env.MUZIK || path.join(process.env.HOME, '.cache/acik-kaynak/brag/skills/brag/assets/music/happy-beats-business-moves-vol-10-by-ende-dot-app.mp3');
const SFX = process.env.SFX || path.join(process.env.HOME, '.cache/acik-kaynak/brag/skills/brag/assets/sfx');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p.goto('http://localhost:8765/pazarlama/video/sahne.html?f=' + F);
  const { SURE } = await p.evaluate(() => window.hazir);
  if (process.argv[3] === 'kare') {
    for (const s of process.argv[4].split(',')) { await p.evaluate((t) => render(t), +s); await p.screenshot({ path: `${CIKTI}/kare-${F}-${s}.png` }); }
    await b.close(); return;
  }
  const N = Math.round(SURE * FPS), sessiz = path.join(CIKTI, `sessiz-${F}.mp4`);
  if (process.argv[3] !== 'ses') { // 'ses': görüntü hazır, yalnız ses yeniden miksle
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', sessiz], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < N; i++) {
    await p.evaluate((t) => render(t), i / FPS);
    const buf = await p.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(F, i, '/', N);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  }
  await b.close();
  // Ses: müzik + birkaç yumuşak efekt, vuruşlara oturtulmuş
  const B = (n) => 0.27 + n * 60 / 110;
  const efekt = [['impact/impactSoft_medium_001.ogg', B(1) - .05, .5], ['impact/impactSoft_medium_002.ogg', B(16), .45],
    ...[24, 24.5, 25, 25.5].map((n) => ['interface/click_003.ogg', B(n), .35]), ['interface/bong_001.ogg', B(27), .35],
    ['interface/click_002.ogg', B(50.5), .35], ['interface/click_002.ogg', B(72), .35], ['impact/impactSoft_medium_004.ogg', B(82), .45]];
  // Sesli anlatım (anlatim.js ile üretilir): parçalar sahne başlarına, müzik konuşmada kısılır
  const PARCALAR = require('./anlatim.js'), SESDIR = path.join(CIKTI, 'ses');
  const anlatimVar = fs.existsSync(path.join(SESDIR, '00.wav'));
  const gir = ['-i', sessiz, '-i', MUZIK]; let fc = `[1:a]atrim=0:${SURE.toFixed(3)},afade=t=in:d=0.2,afade=t=out:st=${(SURE - 2).toFixed(3)}:d=2,volume=${anlatimVar ? 0.7 : 0.8}[m0]`; const etiket = [];
  efekt.forEach(([d, t, v], i) => { gir.push('-i', path.join(SFX, d)); fc += `;[${i + 2}:a]adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)},volume=${v * (anlatimVar ? .7 : 1)}[e${i}]`; etiket.push(`[e${i}]`); });
  if (anlatimVar) {
    const k = efekt.length + 2, ses = [];
    PARCALAR.forEach(([t], i) => { gir.push('-i', path.join(SESDIR, String(i).padStart(2, '0') + '.wav')); const ms = Math.round(t * 1000); fc += `;[${k + i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[s${i}]`; ses.push(`[s${i}]`); });
    fc += `;${ses.join('')}amix=inputs=${ses.length}:normalize=0,volume=1.6,asplit=2[v][vk0];[vk0]apad[vk]`;
    fc += `;[m0][vk]sidechaincompress=threshold=0.02:ratio=6:attack=30:release=400[m]`;
    etiket.unshift('[m]', '[v]');
  } else { fc = fc.replace('[m0]', '[m]'); etiket.unshift('[m]'); }
  fc += `;${etiket.join('')}amix=inputs=${etiket.length}:normalize=0,alimiter=limit=0.89[a]`;
  const son = path.join(CIKTI, `kitabim-hangi-rafta-tanitim-${F === 'v' ? 'dikey' : 'yatay'}.mp4`);
  await new Promise((r, j) => spawn('ffmpeg', ['-loglevel', 'error', '-y', ...gir, '-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', son], { stdio: 'inherit' }).on('close', (c) => c ? j(c) : r()));
  console.log('bitti', son, N, 'kare');
})();

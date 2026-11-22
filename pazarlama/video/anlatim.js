// Sesli anlatım: her sahne için Gemini TTS (ücretsiz kota) ile Türkçe ses üretir → cikti/ses/NN.wav
// Kullanım: node pazarlama/video/anlatim.js [ses adı, varsayılan Kore]
// Anahtar ortamın ağ vekilinde (generativelanguage.googleapis.com); başka yerde GEMINI_API_KEY verin.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const SES = process.argv[2] || 'Kore';
const OUT = path.join(__dirname, 'cikti/ses'); fs.mkdirSync(OUT, { recursive: true });
const B = (n) => 0.27 + n * 60 / 110;
// [başlangıç, sahne sonu, metin]
const PARCALAR = [
  [B(0.6), B(8), 'Bu kitap hangi rafta? Her gün duyulan soru.'],
  [B(8.6), B(16), 'Çalışan raf raf arar, müşteri bekler.'],
  [B(16.5), B(22), 'Kitabım Hangi Rafta ile müşteri kendi bulur.'],
  [B(22.6), B(30), 'Kitabın adını yazar ya da barkodunu okutur.'],
  [B(30.3), B(38), 'Ekran rafı ve bölmeyi gösterir, yolunu da çizer.'],
  [B(38.5), B(48), 'Veli okulu ve sınıfı seçer, listedeki kitapları raflarıyla görür.'],
  [B(48.5), B(53), 'Bulamadığı kitap için talep bırakır.'],
  [B(53.3), B(59), 'Panelde en çok istenen kitap en üstte görünür.'],
  [B(59.5), B(69), 'Excel listesini yükleyin; barkodu okutun, kitap rafına kaydolsun.'],
  [B(69.4), B(80), 'Müşteri beklemez, çalışan aramaz. Ücretsiz denemek için hemen yazın.'],
];
module.exports = PARCALAR;
if (require.main === module) {
  const anahtar = process.env.GEMINI_API_KEY || 'vekil';
  const metin = PARCALAR.map((p) => p[2]).join('\n\n... \n\n');
  const govde = JSON.stringify({ contents: [{ parts: [{ text: 'Sıcak, güven veren, enerjik bir Türkçe reklam seslendirmesi gibi, doğal ve akıcı oku. Her paragraftan sonra iki saniye tam sessizlik bırak:\n\n' + metin }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: SES } } } } });
  // curl: ortamın vekili anahtarı ekler (Node fetch vekili kullanmaz)
  const yanit = execFileSync('curl', ['-s', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent',
    '-H', 'x-goog-api-key: ' + anahtar, '-H', 'Content-Type: application/json', '--data-binary', '@-'], { input: govde, maxBuffer: 1 << 28 }).toString();
  const d = JSON.parse(yanit).candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!d) { console.error(yanit.slice(0, 400)); process.exit(1); }
  const pcm = path.join(OUT, 'tam.pcm'), tam = path.join(OUT, 'tam.wav'); fs.writeFileSync(pcm, Buffer.from(d, 'base64'));
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcm, tam]); fs.unlinkSync(pcm);
  bol(tam);
}
// tam.wav'ı 0,6 sn'den uzun sessizliklerden parçalara böler
function bol(tam) {
  const log = require('child_process').spawnSync('ffmpeg', ['-i', tam, '-af', 'silencedetect=noise=-40dB:d=0.6', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const bas = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]), son = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  const toplam = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', tam]).toString();
  const araliklar = []; let a = 0;
  bas.forEach((s, i) => { if (s - a > 0.3) araliklar.push([a, s]); a = son[i] ?? toplam; }); if (toplam - a > 0.3) araliklar.push([a, toplam]);
  console.log('parça', araliklar.length, '/', PARCALAR.length);
  if (araliklar.length !== PARCALAR.length) { console.log(araliklar); process.exit(2); }
  araliklar.forEach(([x, y], i) => {
    const f = path.join(OUT, String(i).padStart(2, '0') + '.wav');
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', tam, '-ss', String(Math.max(0, x - 0.05)), '-to', String(y + 0.08), f]);
    const pay = PARCALAR[i][1] - PARCALAR[i][0] - 0.2;
    console.log(i, (y - x).toFixed(2), '/', pay.toFixed(2), y - x > pay ? 'UZUN' : 'ok');
  });
}
module.exports.bol = bol;

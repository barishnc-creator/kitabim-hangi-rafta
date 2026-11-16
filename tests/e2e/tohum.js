// Testler için örnek mağaza (tarayıcı içinde çalışır: page.evaluate(tohum)).
module.exports = function tohum() {
  const id = () => Math.random().toString(36).slice(2, 10);
  const raflar = [['Okul kitapları', 4], ['Test ve deneme', 4], ['Roman ve hikâye', 3], ['Sözlük ve atlas', 2]].map((r, i) => ({ id: 'r' + (i + 1), no: i + 1, etiket: r[0], bolmeler: Array.from({ length: r[1] }, (_, j) => ({ id: 'b' + (i + 1) + (j + 1), no: j + 1 })) }));
  const b = (k) => 'b' + k.replace('.', '');
  const g = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const kitaplar = [
    ['k1', '7. Sınıf Matematik Soru Bankası', 'Örnek Yazar', 'Örnek Yayınları', '2.3', 249.9, 5, 9],
    ['k2', '7. Sınıf Fen Bilimleri Konu Anlatımı', 'Örnek Yazar', 'Örnek Yayınları', '1.2', 195, 4, 8],
    ['k3', '7. Sınıf Türkçe Soru Bankası', 'Örnek Yazar', 'Örnek Yayınları', '1.1', 180, 1, 7],
    ['k4', '7. Sınıf İngilizce Workbook', 'Örnek Yazar', 'Örnek Yayınları', '1.4', 175, 0, 6],
    ['k5', '8. Sınıf LGS Deneme Seti', 'Örnek Yazar', 'Örnek Yayınları', '2.1', 310, 2, 6],
    ['k6', 'Kürk Mantolu Madonna', 'Sabahattin Ali', 'Yapı Kredi Yayınları', '3.1', 125, 12, 3],
    ['k7', 'Simyacı', 'Paulo Coelho', 'Can Yayınları', '3.2', 160, 4, 3],
    ['k8', 'Küçük Prens', 'Antoine de Saint-Exupéry', 'Can Çocuk', '3.2', 95, 3, 2],
    ['k9', 'Türkçe Sözlük', 'TDK', 'TDK Yayınları', '4.1', 450, 2, 1]
  ].map((k) => ({ id: k[0], ad: k[1], yazar: k[2], yayinevi: k[3], barkod: '', bolmeId: b(k[4]), fiyat: k[5], stok: k[6], kapak: '', eklendi: g(k[7]) }));
  localStorage.setItem('kitabim-hangi-rafta:v1', JSON.stringify({ raflar, kitaplar, okulListeleri: [], ayarlar: { fiyat: true, stok: true, magazaAdi: 'Örnek Kırtasiye' } }));
  localStorage.removeItem('kitabim-hangi-rafta:aramalar');
};

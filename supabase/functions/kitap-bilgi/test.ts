// Çalıştırma: KITAP_BILGI_TEST=1 deno test supabase/functions/kitap-bilgi/test.ts
// Google'a gidilmez; fetch sahtedir.
import { isle, jsonCikar, isbnMi } from "./index.ts";

function esit(a: unknown, b: unknown, mesaj = "") {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${mesaj}\n  beklenen: ${y}\n  gelen:    ${x}`);
}

type Kural = [RegExp, (url: string, govde: Record<string, unknown> | null) => Response];
function ortam(kurallar: Kural[], model = "") {
  const istekler: { url: string; govde: Record<string, unknown> | null }[] = [];
  const kaydedilen: string[] = [];
  const sahteFetch = ((url: string, init?: RequestInit) => {
    const govde = init?.body ? JSON.parse(String(init.body)) : null;
    istekler.push({ url, govde });
    for (const [desen, cevap] of kurallar) if (desen.test(url)) return Promise.resolve(cevap(url, govde));
    return Promise.resolve(new Response("{}", { status: 404 }));
  }) as typeof fetch;
  return {
    istekler,
    kaydedilen,
    o: {
      anahtar: "test-anahtar",
      model,
      fetch: sahteFetch,
      kapakKaydet: (_b: Uint8Array, ad: string) => { kaydedilen.push(ad); return Promise.resolve("https://depo.ornek/kapaklar/" + ad); },
    },
  };
}
const j = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status });
const geminiCevap = (metin: string) => j({ candidates: [{ content: { parts: [{ text: metin }] } }] });
const ISBN = "9786259506586";

Deno.test("ISBN kontrolü ve JSON çıkarma", () => {
  esit(isbnMi(ISBN), true);
  esit(isbnMi("9786259506587"), false);
  esit(jsonCikar('```json\n{"ad":"Kınalı Serçe","bulundu":true}\n```'), { ad: "Kınalı Serçe", bulundu: true });
  esit(jsonCikar("bulamadım"), null);
});

Deno.test("Google Kitaplar tam bilgi verirse yapay zekâya gidilmez", async () => {
  const t = ortam([[/googleapis\.com\/books/, () => j({ items: [{ volumeInfo: { title: "Kınalı Serçe", authors: ["Şermin Yaşar"], publisher: "Kronik", imageLinks: { thumbnail: "http://books.google/k.jpg" } } }] })]]);
  const r = await isle({ islem: "isbn", isbn: ISBN }, t.o);
  esit(r.veri, { bilgi: { ad: "Kınalı Serçe", yazar: "Şermin Yaşar", yayinevi: "Kronik", kapak: "https://books.google/k.jpg", kaynak: "google-kitaplar" } });
  esit(t.istekler.length, 1);
  esit(t.istekler[0].url.includes("key=test-anahtar"), true, "Google Kitaplar'a kendi anahtarımızla gidilmeli");
});

Deno.test("Google Kitaplar ve Open Library bulamazsa Google Arama ile bulunur", async () => {
  const t = ortam([
    [/googleapis\.com\/books/, () => j({ totalItems: 0 })],
    [/openlibrary/, () => j({})],
    [/gemini-2\.5-flash:generateContent/, () => geminiCevap('```json\n{"bulundu": true, "ad": "Kınalı Serçe", "yazar": "Şermin Yaşar, İlber Ortaylı", "yayinevi": "Kronik Kitap"}\n```')],
  ]);
  const r = await isle({ islem: "isbn", isbn: ISBN }, t.o);
  esit(r.veri, { bilgi: { ad: "Kınalı Serçe", yazar: "Şermin Yaşar, İlber Ortaylı", yayinevi: "Kronik Kitap", kapak: "", kaynak: "google-arama" } });
  const g = t.istekler.find((x) => x.url.includes("generateContent"))!;
  esit(JSON.stringify(g.govde?.tools), '[{"google_search":{}}]', "Google Arama aracı açık olmalı");
});

Deno.test("Google Kitaplar eksik bilgi verirse kapağı korunur, eksikler aramayla tamamlanır", async () => {
  const t = ortam([
    [/googleapis\.com\/books/, () => j({ items: [{ volumeInfo: { title: "Kınalı Serçe", imageLinks: { thumbnail: "https://b/k.jpg" } } }] })],
    [/openlibrary/, () => j({})],
    [/generateContent/, () => geminiCevap('{"bulundu": true, "ad": "Kınalı Serçe", "yazar": "Şermin Yaşar", "yayinevi": "Kronik Kitap"}')],
  ]);
  const r = await isle({ islem: "isbn", isbn: ISBN }, t.o);
  esit((r.veri as { bilgi: { kapak: string; yayinevi: string } }).bilgi.kapak, "https://b/k.jpg");
  esit((r.veri as { bilgi: { kapak: string; yayinevi: string } }).bilgi.yayinevi, "Kronik Kitap");
});

Deno.test("Yapay zekâ bulamadım derse uydurma bilgi dönmez", async () => {
  const t = ortam([[/generateContent/, () => geminiCevap('{"bulundu": false}')]]);
  const r = await isle({ islem: "isbn", isbn: ISBN }, t.o);
  esit(r.veri, { bilgi: null });
});

Deno.test("Model emekliye ayrılmışsa (404) sıradaki model denenir", async () => {
  const t = ortam([
    [/eski-model:generateContent/, () => j({ error: "yok" }, 404)],
    [/gemini-2\.5-flash:generateContent/, () => geminiCevap('{"bulundu": true, "ad": "Kitap", "yazar": "Y", "yayinevi": "P"}')],
  ], "eski-model");
  const r = await isle({ islem: "isbn", isbn: ISBN }, t.o);
  esit((r.veri as { bilgi: { ad: string } }).bilgi.ad, "Kitap");
});

Deno.test("Yapay zekâ kotası dolarsa uyarı döner, hata fırlatmaz", async () => {
  const t = ortam([[/generateContent/, () => j({}, 429)]]);
  const r = await isle({ islem: "isbn", isbn: ISBN }, t.o);
  esit(r.veri, { bilgi: null, uyari: "Yapay zekâ günlük ücretsiz sınırına ulaştı." });
});

Deno.test("Geçersiz ISBN reddedilir, dışarıya istek gitmez", async () => {
  const t = ortam([]);
  const r = await isle({ islem: "isbn", isbn: "9786259506587" }, t.o);
  esit(r.durum, 400);
  esit(t.istekler.length, 0);
});

const RESIM = btoa("sahte-jpeg-baytlari");

Deno.test("Kapak: fotoğraf kaydedilir, bilgiler kapaktan okunur", async () => {
  const t = ortam([[/generateContent/, () => geminiCevap('{"bulundu": true, "ad": "Kınalı Serçe", "yazar": "Şermin Yaşar", "yayinevi": ""}')]]);
  const r = await isle({ islem: "kapak", resim: "data:image/jpeg;base64," + RESIM, isbn: ISBN }, t.o);
  const v = r.veri as { bilgi: { ad: string; kapak: string }; kapak: string };
  esit(v.bilgi.ad, "Kınalı Serçe");
  esit(v.kapak.startsWith("https://depo.ornek/kapaklar/9786259506586-"), true);
  esit(v.bilgi.kapak, v.kapak);
  const g = t.istekler[0].govde as { contents: { parts: { inline_data?: { data: string } }[] }[]; generationConfig: { responseMimeType: string } };
  esit(g.contents[0].parts[1].inline_data?.data, RESIM, "resim yapay zekâya gitmeli");
  esit(g.generationConfig.responseMimeType, "application/json");
});

Deno.test("Kapak: yapay zekâ çalışmasa da fotoğraf kapak olarak kalır", async () => {
  const t = ortam([[/generateContent/, () => j({}, 500)]]);
  const r = await isle({ islem: "kapak", resim: RESIM }, t.o);
  const v = r.veri as { bilgi: null; kapak: string; uyari: string };
  esit(v.bilgi, null);
  esit(v.kapak.startsWith("https://depo.ornek/kapaklar/kapak-"), true);
  esit(v.uyari.startsWith("Yapay zekâ hatası (500)"), true);
});

Deno.test("Kapak: bozuk ya da çok büyük resim reddedilir", async () => {
  const t = ortam([]);
  esit((await isle({ islem: "kapak", resim: "<script>" }, t.o)).durum, 400);
  esit((await isle({ islem: "kapak", resim: "A".repeat(1_400_001) }, t.o)).durum, 400);
  esit(t.kaydedilen.length, 0);
});

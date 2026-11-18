// Kitabım Hangi Rafta: barkoddan ve kapak fotoğrafından kitap bilgisi.
// Google anahtarı tarayıcıya gitmesin diye istekler buradan yapılır (anahtar Supabase gizli değeri GOOGLE_API_KEY).
// İşlemler:
//   isbn  { isbn }          → Google Kitaplar (kendi anahtarımızla) → Open Library → Gemini + Google Arama
//   kapak { resim, isbn? }  → kapak fotoğrafı depoya kaydedilir, Gemini kapaktan ad/yazar/yayınevi okur
// Yalnız giriş yapmış düzenleyici ve çalışan kullanabilir.
// Ayarlar (Supabase → Edge Functions → Secrets): GOOGLE_API_KEY (zorunlu), GEMINI_MODEL (isteğe bağlı).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Bilgi = { ad: string; yazar: string; yayinevi: string; kapak: string; kaynak: string };
type Ortam = {
  anahtar: string;
  model: string;
  fetch: typeof fetch;
  // Kapak fotoğrafını depoya koyar, herkese açık adresini döndürür.
  kapakKaydet: (bayt: Uint8Array, ad: string) => Promise<string>;
};

// Model emekliye ayrılırsa (404) sıradaki denenir; GEMINI_MODEL ile değiştirilebilir.
const YEDEK_MODELLER = ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];

const temiz = (x: unknown, uzunluk = 200) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, uzunluk);

export function isbnMi(kod: string) {
  if (!/^97[89]\d{10}$/.test(kod)) return false;
  let t = 0;
  for (let i = 0; i < 12; i++) t += Number(kod[i]) * (i % 2 ? 3 : 1);
  return (10 - (t % 10)) % 10 === Number(kod[12]);
}

// Modelin cevabından ilk JSON nesnesini çıkarır (```json ... ``` içinde de olabilir).
export function jsonCikar(metin: string): Record<string, unknown> | null {
  const m = /\{[\s\S]*\}/.exec(metin || "");
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    return o && typeof o === "object" ? o : null;
  } catch {
    return null;
  }
}

function bilgiYap(o: Record<string, unknown> | null, kaynak: string, kapak = ""): Bilgi | null {
  if (!o || o.bulundu === false) return null;
  const ad = temiz(o.ad);
  if (!ad) return null;
  return { ad, yazar: temiz(o.yazar), yayinevi: temiz(o.yayinevi), kapak, kaynak };
}

async function googleKitaplar(isbn: string, o: Ortam): Promise<Bilgi | null> {
  try {
    const r = await o.fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${encodeURIComponent(o.anahtar)}`);
    if (!r.ok) return null; // Books API bu anahtarda açık değilse 403 döner; sıradaki kaynağa geçilir
    const v = (await r.json())?.items?.[0]?.volumeInfo;
    if (!v?.title) return null;
    return {
      ad: temiz(v.subtitle ? `${v.title}: ${v.subtitle}` : v.title),
      yazar: temiz((v.authors || []).join(", ")),
      yayinevi: temiz(v.publisher),
      kapak: temiz(v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail, 500).replace(/^http:\/\//, "https://"),
      kaynak: "google-kitaplar",
    };
  } catch {
    return null;
  }
}

async function openLibrary(isbn: string, o: Ortam): Promise<Bilgi | null> {
  try {
    const r = await o.fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    if (!r.ok) return null;
    const v = (await r.json())?.[`ISBN:${isbn}`];
    if (!v?.title) return null;
    return {
      ad: temiz(v.subtitle ? `${v.title}: ${v.subtitle}` : v.title),
      yazar: temiz((v.authors || []).map((a: { name: string }) => a.name).join(", ")),
      yayinevi: temiz((v.publishers || []).map((p: { name: string }) => p.name).join(", ")),
      kapak: temiz(v.cover?.medium || v.cover?.small, 500),
      kaynak: "open-library",
    };
  } catch {
    return null;
  }
}

// İki kaynağı birleştirir: ilkinin dolu alanları önceliklidir.
function birlestir(a: Bilgi | null, b: Bilgi | null): Bilgi | null {
  if (!a || !b) return a || b;
  return { ad: a.ad || b.ad, yazar: a.yazar || b.yazar, yayinevi: a.yayinevi || b.yayinevi, kapak: a.kapak || b.kapak, kaynak: a.kaynak };
}

export class GeminiHatasi extends Error {
  constructor(mesaj: string, public kota = false) { super(mesaj); }
}

async function gemini(parts: unknown[], o: Ortam, secenek: { arama?: boolean; sema?: unknown }): Promise<string> {
  const modeller = [...new Set([o.model, ...YEDEK_MODELLER].filter(Boolean))];
  for (const model of modeller) {
    const govde: Record<string, unknown> = { contents: [{ role: "user", parts }], generationConfig: { temperature: 0 } };
    if (secenek.arama) govde.tools = [{ google_search: {} }];
    else if (secenek.sema) {
      (govde.generationConfig as Record<string, unknown>).responseMimeType = "application/json";
      (govde.generationConfig as Record<string, unknown>).responseSchema = secenek.sema;
    }
    const r = await o.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": o.anahtar },
      body: JSON.stringify(govde),
    });
    if (r.status === 404) continue; // model yok ya da emekli: sıradakini dene
    if (r.status === 429) throw new GeminiHatasi("Yapay zekâ günlük ücretsiz sınırına ulaştı.", true);
    if (!r.ok) throw new GeminiHatasi(`Yapay zekâ hatası (${r.status}): ${temiz(await r.text(), 160)}`);
    const j = await r.json();
    return (j?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
  }
  throw new GeminiHatasi("Yapay zekâ modeli bulunamadı; GEMINI_MODEL ayarını güncelleyin.");
}

async function aramaIleBul(isbn: string, o: Ortam): Promise<Bilgi | null> {
  const istem =
    `ISBN ${isbn} olan kitabı Google'da ara. Yalnız sayfasında bu ISBN geçen kaynaklara (kitapçı, yayınevi, kütüphane) güven.\n` +
    `Sadece şu JSON'u döndür, başka bir şey yazma:\n` +
    `{"bulundu": true, "ad": "kitabın adı", "yazar": "yazar(lar), virgülle; çevirmen ve resimleyen hariç", "yayinevi": "yayınevi"}\n` +
    `Kitabı kesin bulamazsan {"bulundu": false} döndür. Asla tahmin etme, uydurma.`;
  return bilgiYap(jsonCikar(await gemini([{ text: istem }], o, { arama: true })), "google-arama");
}

const KAPAK_SEMASI = {
  type: "OBJECT",
  properties: {
    bulundu: { type: "BOOLEAN" },
    ad: { type: "STRING" },
    yazar: { type: "STRING" },
    yayinevi: { type: "STRING" },
  },
  required: ["bulundu", "ad", "yazar", "yayinevi"],
};

async function kapaktanOku(resimB64: string, o: Ortam) {
  const istem =
    "Bu bir kitap kapağının fotoğrafı. Kapakta yazanlara bakarak kitabın adını, yazarını ve yayınevini çıkar. " +
    "Yazılar kapakta nasılsa öyle yaz (Türkçe karakterlerle), ama tamamı büyük harfse normal yazıma çevir (örn. KÜRK MANTOLU MADONNA → Kürk Mantolu Madonna). " +
    "Alt başlık varsa adın sonuna ': ' ile ekle. Çevirmen, resimleyen, dizi adı ve slogan yazar sayılmaz. " +
    "Yayınevi kapakta yoksa logodan tanıyabiliyorsan yaz, yoksa boş bırak. Fotoğrafta kitap kapağı yoksa bulundu: false ver.";
  const metin = await gemini([{ text: istem }, { inline_data: { mime_type: "image/jpeg", data: resimB64 } }], o, { sema: KAPAK_SEMASI });
  return bilgiYap(jsonCikar(metin), "kapak");
}

function base64Bayt(b64: string) {
  const ikili = atob(b64);
  const bayt = new Uint8Array(ikili.length);
  for (let i = 0; i < ikili.length; i++) bayt[i] = ikili.charCodeAt(i);
  return bayt;
}

// Yetki denetimi yapılmış bir isteği işler. Testler bu fonksiyonu doğrudan çağırır.
export async function isle(govde: Record<string, unknown>, o: Ortam): Promise<{ durum: number; veri: unknown }> {
  const islem = String(govde.islem || "");
  if (islem === "isbn") {
    const isbn = String(govde.isbn || "").replace(/\D/g, "");
    if (!isbnMi(isbn)) return { durum: 400, veri: { hata: "Geçerli bir ISBN değil." } };
    const g = await googleKitaplar(isbn, o);
    if (g && g.yazar && g.yayinevi) return { durum: 200, veri: { bilgi: g } };
    const ol = await openLibrary(isbn, o);
    const birlesik = birlestir(g, ol);
    if (birlesik && birlesik.yazar && birlesik.yayinevi) return { durum: 200, veri: { bilgi: birlesik } };
    try {
      const a = await aramaIleBul(isbn, o);
      if (a) {
        // Google Kitaplar/Open Library'den gelen kapak resmi varsa onu koru.
        return { durum: 200, veri: { bilgi: { ...a, kapak: birlesik?.kapak || "" } } };
      }
    } catch (e) {
      if (birlesik) return { durum: 200, veri: { bilgi: birlesik } };
      return { durum: 200, veri: { bilgi: null, uyari: e instanceof Error ? e.message : String(e) } };
    }
    return { durum: 200, veri: { bilgi: birlesik } };
  }

  if (islem === "kapak") {
    const resim = String(govde.resim || "").replace(/^data:image\/\w+;base64,/, "");
    if (!resim || resim.length > 1_400_000 || !/^[A-Za-z0-9+/=]+$/.test(resim)) {
      return { durum: 400, veri: { hata: "Kapak fotoğrafı okunamadı (çok büyük ya da bozuk)." } };
    }
    const isbn = String(govde.isbn || "").replace(/\D/g, "").slice(0, 13);
    // 1,4 milyon base64 karakter ≈ 1 MB: depo sınırı (kapak-depo.sql). Tarayıcı fotoğrafı 1024 px’e küçültüp ~200 KB gönderir.
    // Önce fotoğrafı kaydet: yapay zekâ çalışmasa da kapak resmi kalsın.
    let kapak = "";
    let depoHatasi = "";
    try {
      kapak = await o.kapakKaydet(base64Bayt(resim), `${isbn || "kapak"}-${Date.now()}.jpg`);
    } catch (e) {
      depoHatasi = e instanceof Error ? e.message : String(e);
    }
    try {
      const b = await kapaktanOku(resim, o);
      return { durum: 200, veri: { bilgi: b ? { ...b, kapak } : null, kapak, depoHatasi: depoHatasi || undefined } };
    } catch (e) {
      return { durum: 200, veri: { bilgi: null, kapak, uyari: e instanceof Error ? e.message : String(e), depoHatasi: depoHatasi || undefined } };
    }
  }

  return { durum: 400, veri: { hata: "Bilinmeyen işlem." } };
}

if (!Deno.env.get("KITAP_BILGI_TEST")) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return json({ hata: "POST gerekli" }, 405);

    const anahtar = Deno.env.get("GOOGLE_API_KEY") || "";
    if (!anahtar) return json({ hata: "GOOGLE_API_KEY tanımlı değil.", kurulumEksik: true }, 503);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: ben } = await db.auth.getUser(token);
    if (!ben?.user) return json({ hata: "Giriş yapın." }, 401);
    const { data: uyelik } = await db.from("kirtasiye_uyeler").select("rol").eq("user_id", ben.user.id).maybeSingle();
    if (!uyelik || !["duzenleyici", "calisan"].includes(uyelik.rol)) {
      return json({ hata: "Bu işlem için kitap ekleme yetkisi gerekir." }, 403);
    }

    let govde: Record<string, unknown>;
    try { govde = await req.json(); } catch { return json({ hata: "Geçersiz istek" }, 400); }

    try {
      const { durum, veri } = await isle(govde, {
        anahtar,
        model: Deno.env.get("GEMINI_MODEL") || "",
        fetch,
        kapakKaydet: async (bayt, ad) => {
          const { error } = await db.storage.from("kapaklar").upload(ad, bayt, { contentType: "image/jpeg", upsert: false });
          if (error) throw new Error("Kapak kaydedilemedi: " + error.message);
          return db.storage.from("kapaklar").getPublicUrl(ad).data.publicUrl;
        },
      });
      return json(veri, durum);
    } catch (e) {
      return json({ hata: e instanceof Error ? e.message : "Beklenmeyen hata" }, 500);
    }
  });
}

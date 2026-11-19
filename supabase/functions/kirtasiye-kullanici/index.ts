// Kitabım Hangi Rafta: kullanıcı yönetimi.
// Hesap açmak service role gerektirdiği için tarayıcıdan değil buradan yapılır.
// İşlemler: durum, ilk-kurulum, ekle, rol, sifre, kaldir.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const hata = (mesaj: string, status = 400) => json({ hata: mesaj }, status);

const ROLLER = ["duzenleyici", "revizeci", "calisan"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return hata("POST gerekli", 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let govde: Record<string, unknown>;
  try { govde = await req.json(); } catch { return hata("Geçersiz istek"); }
  const islem = String(govde.islem || "");

  const duzenleyiciSayisi = async () => {
    const { count } = await db.from("kirtasiye_uyeler").select("user_id", { count: "exact", head: true }).eq("rol", "duzenleyici");
    return count ?? 0;
  };

  // E-postası verilen hesabı açar; zaten varsa mevcut hesabı döndürür (şifresine dokunmaz).
  const hesapAcVeyaBul = async (eposta: string, sifre: string) => {
    const { data, error } = await db.auth.admin.createUser({ email: eposta, password: sifre, email_confirm: true });
    if (!error && data.user) return { id: data.user.id, yeni: true };
    for (let sayfa = 1; sayfa <= 20; sayfa++) {
      const { data: l } = await db.auth.admin.listUsers({ page: sayfa, perPage: 200 });
      const u = l?.users.find((x) => (x.email || "").toLowerCase() === eposta);
      if (u) return { id: u.id, yeni: false };
      if (!l || l.users.length < 200) break;
    }
    throw new Error(error?.message?.includes("Password") ? "Şifre en az 6 karakter olmalı." : "Hesap açılamadı: " + (error?.message || ""));
  };

  const girdi = () => {
    const ad = String(govde.ad || "").trim();
    const eposta = String(govde.eposta || "").trim().toLowerCase();
    const sifre = String(govde.sifre || "");
    if (!ad) throw new Error("Ad boş olamaz.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) throw new Error("Geçerli bir e-posta girin.");
    if (sifre.length < 6) throw new Error("Şifre en az 6 karakter olmalı.");
    return { ad, eposta, sifre };
  };

  try {
    if (islem === "durum") return json({ kurulumGerekli: (await duzenleyiciSayisi()) === 0 });

    if (islem === "ilk-kurulum") {
      if ((await duzenleyiciSayisi()) > 0) return hata("Kurulum zaten yapılmış.", 403);
      const { ad, eposta, sifre } = girdi();
      const h = await hesapAcVeyaBul(eposta, sifre);
      if (!h.yeni) return hata("Bu e-posta başka bir uygulamada kayıtlı. Farklı bir e-posta kullanın.");
      await db.from("kirtasiye_uyeler").insert({ user_id: h.id, ad, eposta, rol: "duzenleyici", kirtasiye_hesabi: true }).throwOnError();
      return json({ tamam: true });
    }

    // Buradan sonrası: yalnız düzenleyici.
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: ben } = await db.auth.getUser(token);
    if (!ben?.user) return hata("Giriş yapın.", 401);
    const { data: benimUyelik } = await db.from("kirtasiye_uyeler").select("rol").eq("user_id", ben.user.id).maybeSingle();
    if (benimUyelik?.rol !== "duzenleyici") return hata("Bu işlem için düzenleyici yetkisi gerekir.", 403);

    const hedefId = String(govde.user_id || "");
    const hedef = async () => {
      const { data } = await db.from("kirtasiye_uyeler").select("*").eq("user_id", hedefId).maybeSingle();
      if (!data) throw new Error("Kullanıcı bulunamadı.");
      return data;
    };

    if (islem === "ekle") {
      const { ad, eposta, sifre } = girdi();
      const rol = String(govde.rol);
      if (!ROLLER.includes(rol)) return hata("Geçersiz yetki.");
      const h = await hesapAcVeyaBul(eposta, sifre);
      const { data: var_ } = await db.from("kirtasiye_uyeler").select("user_id").eq("user_id", h.id).maybeSingle();
      if (var_) return hata("Bu kişi zaten listede.");
      await db.from("kirtasiye_uyeler").insert({ user_id: h.id, ad, eposta, rol, kirtasiye_hesabi: h.yeni }).throwOnError();
      return json({ tamam: true, mevcutHesap: !h.yeni });
    }

    if (islem === "rol") {
      const rol = String(govde.rol);
      if (!ROLLER.includes(rol)) return hata("Geçersiz yetki.");
      const u = await hedef();
      if (u.rol === "duzenleyici" && rol !== "duzenleyici" && (await duzenleyiciSayisi()) <= 1) {
        return hata("En az bir düzenleyici kalmalı.");
      }
      await db.from("kirtasiye_uyeler").update({ rol }).eq("user_id", hedefId).throwOnError();
      return json({ tamam: true });
    }

    if (islem === "sifre") {
      const u = await hedef();
      if (!u.kirtasiye_hesabi) return hata("Bu hesap başka bir uygulamaya ait; şifresi buradan değiştirilemez.");
      const sifre = String(govde.sifre || "");
      if (sifre.length < 6) return hata("Şifre en az 6 karakter olmalı.");
      const { error } = await db.auth.admin.updateUserById(hedefId, { password: sifre });
      if (error) throw error;
      return json({ tamam: true });
    }

    if (islem === "kaldir") {
      const u = await hedef();
      if (u.rol === "duzenleyici" && (await duzenleyiciSayisi()) <= 1) return hata("Son düzenleyici kaldırılamaz.");
      await db.from("kirtasiye_uyeler").delete().eq("user_id", hedefId).throwOnError();
      // Hesabı bu program açtıysa hesabı da sil; başka uygulamanın hesabına dokunma.
      if (u.kirtasiye_hesabi) await db.auth.admin.deleteUser(hedefId);
      return json({ tamam: true });
    }

    return hata("Bilinmeyen işlem.");
  } catch (e) {
    return hata(e instanceof Error ? e.message : "Beklenmeyen hata", 400);
  }
});

// Kitabım Hangi Rafta: kullanıcı yönetimi.
// Hesap açmak service role gerektirdiği için tarayıcıdan değil buradan yapılır.
// İşlemler: durum, ilk-kurulum, ekle, rol, sifre, kaldir.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const hata = (mesaj: string, status = 400) => json({ hata: mesaj }, status);

const ROLLER = ["duzenleyici", "revizeci", "calisan"];
const SIFRE_EN_AZ = 10;

export function sifreDogrula(sifre: string) {
  if (sifre.length < SIFRE_EN_AZ) throw new Error(`Şifre en az ${SIFRE_EN_AZ} karakter olmalı.`);
  return sifre;
}

export function girdiDogrula(govde: Record<string, unknown>) {
  const ad = String(govde.ad || "").trim();
  const eposta = String(govde.eposta || "").trim().toLowerCase();
  if (!ad) throw new Error("Ad boş olamaz.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) throw new Error("Geçerli bir e-posta girin.");
  return { ad, eposta, sifre: sifreDogrula(String(govde.sifre || "")) };
}

// Yeni hesap açar. E-posta önceden kayıtlıysa reddeder: o hesabın şifresini başkası belirlemiş olabilir
// (ör. herkese açık kayıtla), bu yüzden şifresine dokunmadan role bağlamak güvenli değil.
export async function hesapAc(db: SupabaseClient, eposta: string, sifre: string): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({ email: eposta, password: sifre, email_confirm: true });
  if (!error && data.user) return data.user.id;
  const m = error?.message || "";
  if (error?.code === "email_exists" || /already/i.test(m)) {
    throw new Error("Bu e-posta ile zaten bir hesap var; güvenlik için bağlanmadı. Farklı bir e-posta kullanın ya da o hesabı Supabase panelinden (Authentication → Users) silip yeniden ekleyin.");
  }
  if (error?.code === "weak_password" || /password/i.test(m)) throw new Error("Şifre kabul edilmedi; daha uzun bir şifre seçin.");
  throw new Error("Hesap açılamadı: " + m);
}

// Testte sunucu başlatılmaz (KULLANICI_TEST=1).
if (!Deno.env.get("KULLANICI_TEST")) Deno.serve(async (req) => {
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

  try {
    if (islem === "durum") return json({ kurulumGerekli: (await duzenleyiciSayisi()) === 0 });

    if (islem === "ilk-kurulum") {
      if ((await duzenleyiciSayisi()) > 0) return hata("Kurulum zaten yapılmış.", 403);
      const { ad, eposta, sifre } = girdiDogrula(govde);
      const id = await hesapAc(db, eposta, sifre);
      await db.from("kirtasiye_uyeler").insert({ user_id: id, ad, eposta, rol: "duzenleyici", kirtasiye_hesabi: true }).throwOnError();
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
      const { ad, eposta, sifre } = girdiDogrula(govde);
      const rol = String(govde.rol);
      if (!ROLLER.includes(rol)) return hata("Geçersiz yetki.");
      const id = await hesapAc(db, eposta, sifre);
      await db.from("kirtasiye_uyeler").insert({ user_id: id, ad, eposta, rol, kirtasiye_hesabi: true }).throwOnError();
      return json({ tamam: true });
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
      const sifre = sifreDogrula(String(govde.sifre || ""));
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

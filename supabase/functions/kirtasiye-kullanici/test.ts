// Çalıştırma: KULLANICI_TEST=1 deno test supabase/functions/kirtasiye-kullanici/test.ts
// Supabase'e gidilmez; Auth yöneticisi sahtedir.
import { girdiDogrula, hesapAc } from "./index.ts";

async function hataBekle(f: () => unknown, desen: RegExp) {
  try { await f(); } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (!desen.test(m)) throw new Error(`beklenen hata ${desen}, gelen: ${m}`);
    return;
  }
  throw new Error(`hata bekleniyordu (${desen}), çalıştı`);
}

Deno.test("şifre en az 10 karakter (9 reddedilir, 10 kabul)", async () => {
  await hataBekle(() => girdiDogrula({ ad: "Ali", eposta: "ali@ornek.com", sifre: "123456789" }), /en az 10 karakter/);
  const g = girdiDogrula({ ad: " Ali ", eposta: "ALI@ornek.com", sifre: "1234567890" });
  if (g.ad !== "Ali" || g.eposta !== "ali@ornek.com" || g.sifre !== "1234567890") throw new Error(JSON.stringify(g));
});

type Sonuc = { data: { user: { id: string } | null }; error: { message: string; code?: string } | null };
const sahteDb = (sonuc: Sonuc) => {
  const cagri = { listUsers: 0 };
  const db = {
    auth: { admin: {
      createUser: () => Promise.resolve(sonuc),
      listUsers: () => { cagri.listUsers++; return Promise.resolve({ data: { users: [{ id: "eski", email: "ali@ornek.com" }] } }); },
    } },
  };
  return { db, cagri };
};

Deno.test("yeni hesap açılır, kimliği döner", async () => {
  const { db } = sahteDb({ data: { user: { id: "yeni-id" } }, error: null });
  const id = await hesapAc(db as never, "ali@ornek.com", "1234567890");
  if (id !== "yeni-id") throw new Error(id);
});

Deno.test("e-posta önceden kayıtlıysa o hesap role bağlanmaz, reddedilir", async () => {
  const { db, cagri } = sahteDb({ data: { user: null }, error: { message: "A user with this email address has already been registered", code: "email_exists" } });
  await hataBekle(() => hesapAc(db as never, "ali@ornek.com", "1234567890"), /zaten bir hesap var/);
  if (cagri.listUsers !== 0) throw new Error("mevcut hesap aranıp bağlanmamalı");
});

Deno.test("Auth zayıf şifreyi reddederse anlaşılır mesaj", async () => {
  const { db } = sahteDb({ data: { user: null }, error: { message: "Password should be at least 12 characters.", code: "weak_password" } });
  await hataBekle(() => hesapAc(db as never, "ali@ornek.com", "1234567890"), /Şifre/);
});

// Bulut bağlantısı. Yeni bir Supabase projesine taşırken yalnız bu iki satır değişir.
// sb_publishable_ anahtarı tasarım gereği herkese açıktır; gizli anahtar buraya YAZILMAZ.
// İkisi de boşsa ya da adreste ?yerel=1 varsa program verileri cihazda tutar (deneme modu).
window.AYAR = {
  supabaseUrl: 'https://kkcfzrchrdiroiskibhw.supabase.co',
  supabaseKey: 'sb_publishable_bTVxqKLF9lEiwBizbF0Qog_HDeMYL9l',
  // Kullanıcı yönetimi fonksiyonunun Supabase'deki adı (Edge Functions listesindeki ad).
  fonksiyon: 'smart-processor',
  // Kitap bilgisi fonksiyonunun adı (barkoddan Google araması, kapaktan okuma). Kurulmamışsa program eskisi gibi çalışır.
  kitapFonksiyon: 'kitap-bilgi'
};

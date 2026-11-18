// "Uygulama olarak kur" düğmesi: tarayıcı kuruluma izin verince görünür (Chrome, Edge, Android).
// iPhone/iPad'de bu olay yoktur; orada Paylaş > Ana Ekrana Ekle kullanılır.
(function () {
  var dugme = document.getElementById('uygulama-kur');
  if (!dugme) return;
  var bekleyen = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    bekleyen = e;
    dugme.hidden = false;
  });
  dugme.addEventListener('click', function () {
    if (!bekleyen) return;
    bekleyen.prompt();
    bekleyen.userChoice.finally(function () { bekleyen = null; dugme.hidden = true; });
  });
  window.addEventListener('appinstalled', function () { dugme.hidden = true; });
})();

window.KOSAN_CONFIG={intro:true};
/* Intro diputar sebelum konten tergambar, supaya halaman tidak sempat berkedip. */
(function () {
  var cfg = window.KOSAN_CONFIG || {}, KC = window.KC = { introPlaying: false, introDone: false };
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen = false;
  try { seen = sessionStorage.getItem('kc-intro') === '1'; } catch (e) {}
  if (!cfg.intro || reduced || seen) return;
  var el = document.getElementById('intro'), timer;
  el.hidden = false;
  el.classList.add('play');
  document.documentElement.classList.add('intro-on');
  KC.introPlaying = true;
  try { sessionStorage.setItem('kc-intro', '1'); } catch (e) {}
  function leave() {
    if (KC.introDone) return;
    KC.introDone = true;
    clearTimeout(timer);
    el.classList.add('intro-done', 'intro-leaving');
    document.documentElement.classList.remove('intro-on');
    document.dispatchEvent(new Event('kc:intro-end'));
    setTimeout(function () { el.remove(); }, 520);
  }
  timer = setTimeout(function () {
    el.classList.add('intro-done');
    timer = setTimeout(leave, 350);
  }, 3950);
  el.addEventListener('click', leave);
  KC.skipIntro = leave;
})();

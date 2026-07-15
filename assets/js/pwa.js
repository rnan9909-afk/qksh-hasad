/* pwa.js — تسجيل Service Worker وزر تثبيت التطبيق */
(function () {
  // تسجيل الـ Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* تجاهل */ });
    });
  }

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const b = document.getElementById('pwaInstallBtn');
    if (b) b.remove();
  });

  function showInstallButton() {
    if (document.getElementById('pwaInstallBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'pwaInstallBtn';
    btn.type = 'button';
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle;">install_mobile</span> تثبيت التطبيق';
    btn.style.cssText = [
      'position:fixed', 'bottom:16px', 'inset-inline-start:16px', 'z-index:9999',
      'background:linear-gradient(135deg,#256137,#1E4D2B)', 'color:#fff', 'border:none',
      'border-radius:9999px', 'padding:.6rem 1.1rem', 'font-weight:700', 'font-family:inherit',
      'font-size:.9rem', 'display:flex', 'align-items:center', 'gap:.4rem',
      'box-shadow:0 8px 22px -8px rgba(30,77,43,.6)', 'cursor:pointer',
    ].join(';');
    btn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch { /* تجاهل */ }
      deferredPrompt = null;
      btn.remove();
    });
    document.body.appendChild(btn);
  }
})();

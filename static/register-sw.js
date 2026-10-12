/**
 * QuantEdge PWA Registration and Installation Handler
 */

let deferredPrompt = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[QuantEdge PWA] Service Worker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.error('[QuantEdge PWA] Service Worker registration failed:', err);
      });
  });
}

// Intercept standard browser install prompt and provide high-conversion custom UI
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  const installBanner = document.getElementById('pwa-install-banner');
  if (installBanner) {
    installBanner.classList.remove('hidden');
  }
});

export function triggerPwaInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('[QuantEdge PWA] User accepted the installation');
      } else {
        console.log('[QuantEdge PWA] User dismissed the installation');
      }
      deferredPrompt = null;
      const installBanner = document.getElementById('pwa-install-banner');
      if (installBanner) {
        installBanner.classList.add('hidden');
      }
    });
  }
}

window.addEventListener('appinstalled', () => {
  console.log('[QuantEdge PWA] Application was installed successfully');
  const installBanner = document.getElementById('pwa-install-banner');
  if (installBanner) {
    installBanner.classList.add('hidden');
  }
});

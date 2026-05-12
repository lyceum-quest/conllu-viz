const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

async function disableDevServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('conllu-viz-')).map((key) => caches.delete(key)));
  }
}

if (import.meta.env.DEV) {
  window.addEventListener('load', () => {
    disableDevServiceWorkers().catch((err) => console.warn('[pwa] dev service worker cleanup failed', err));
  });
} else if ('serviceWorker' in navigator && (window.isSecureContext || isLocalhost)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('[pwa] service worker registration failed', err));
  });
}

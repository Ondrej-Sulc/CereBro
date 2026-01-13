// sw.js

self.addEventListener('install', () => {
  console.log('Service Worker installing.');
  // Skip waiting to ensure the new service worker activates immediately.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  // Take control of all clients immediately.
  event.waitUntil(clients.claim());
});

self.addEventListener('backgroundfetchsuccess', async (event) => {
  const registration = event.registration;
  console.log('[Service Worker] Background fetch success:', registration.id);

  const records = await registration.matchAll();
  const responsePromises = records.map(async (record) => {
    const response = await record.responseReady;
    // You can process the server response here if needed.
    console.log(`[Service Worker] Fetched response for ${record.request.url}`, response);
  });
  await Promise.all(responsePromises);

  event.updateUI({ title: `Upload Complete: ${registration.id}` });
});

self.addEventListener('backgroundfetchfail', (event) => {
  console.error('[Service Worker] Background fetch failed:', event.registration);
  event.updateUI({ title: `Upload Failed: ${event.registration.id}` });
});

self.addEventListener('backgroundfetchabort', (event) => {
    console.log('[Service Worker] Background fetch aborted:', event.registration);
});

self.addEventListener('backgroundfetchclick', (event) => {
    console.log('[Service Worker] Background fetch click:', event.registration);
    // This is a good place to open the window to the uploads page.
    // clients.openWindow('/war-videos/upload');
});

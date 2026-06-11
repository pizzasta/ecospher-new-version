// Ecosphere service worker — web push only (no offline caching here).
self.addEventListener('push', (event) => {
  let payload = { title: 'Ecosphere', body: 'something moved on the band' }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    /* non-JSON payload — defaults apply */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: payload.tag || 'ecosphere',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client)
      if (existing) return existing.focus()
      return self.clients.openWindow('/')
    }),
  )
})

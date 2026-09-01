self.addEventListener("push", (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data?.text() || "Neue Benachrichtigung" } }

  event.waitUntil(self.registration.showNotification(data.title || "ALI AG", {
    body: data.body || "Sie haben eine neue Benachrichtigung.",
    data: { url: data.url || "/" },
    tag: data.tag || "ali-ag-notification",
    renotify: Boolean(data.renotify),
  }))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || "/"
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if ("focus" in client) {
        client.navigate(targetUrl)
        return client.focus()
      }
    }
    if (clients.openWindow) return clients.openWindow(targetUrl)
  }))
})

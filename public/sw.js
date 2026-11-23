self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() ?? "You have a new notification." };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "iWriter", {
      body: payload.body || "You have a new notification.",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: payload.tag || payload.notificationId || undefined,
      data: { url: payload.url || "/writer/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/writer/notifications", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          await client.navigate(destination);
          return client.focus();
        }
      }
      return self.clients.openWindow(destination);
    }),
  );
});

// Kalp Topla web push (KALP_TOPLA_PLANI.md 7.5): yalniz push ve notificationclick.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Bollmark", {
      body: data.body || "",
      icon: "/icon-512.png",
      data: { link: data.link || "/" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.link));
});

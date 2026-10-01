// Service worker du site : il ne sert qu'aux notifications push. Il affiche ce
// qu'envoie le serveur (src/lib/server/push.ts) et ouvre la bonne page au clic.

self.addEventListener("push", (event) => {
  let message;
  try {
    message = event.data.json();
  } catch {
    return;
  }
  if (!message || typeof message.title !== "string") return;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(message.title, {
        body: message.body,
        tag: message.tag,
        icon: "/images/app/icon-192.png",
        badge: "/images/app/badge.png",
        data: { url: message.url },
      }),
      // Les onglets ouverts mettent leur cloche à jour sans attendre leur prochaine relecture
      self.clients
        .matchAll({ type: "window" })
        .then((windows) => windows.forEach((client) => client.postMessage({ type: "opm:notifications" }))),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // L'adresse vient du serveur ; on n'ouvre de toute façon qu'une page du site
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url === target.href);
      return open ? open.focus() : self.clients.openWindow(target.href);
    }),
  );
});

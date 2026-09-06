self.addEventListener(
    "install",
    (event) => {
        self.skipWaiting();
    }
);

self.addEventListener(
    "activate",
    (event) => {
        event.waitUntil(
            self.clients.claim()
        );
    }
);


/* =========================================================
   PUSH
   ========================================================= */

self.addEventListener(
    "push",
    (event) => {
        let data = {
            title: "JAPY",
            message: "Tienes una nueva notificación.",
            url: "/"
        };

        try {
            if (event.data) {
                data = event.data.json();
            }
        } catch {
            if (event.data) {
                data.message = event.data.text();
            }
        }

        event.waitUntil(
            self.registration.showNotification(
                data.title || "JAPY",
                {
                    body:
                        data.message ||
                        "Tienes una nueva notificación.",

                    icon:
                        "/icon-192.png",

                    badge:
                        "/icon-192.png",

                    tag:
                        data.tag ||
                        "japy-notification",

                    data: {
                        url:
                            data.url ||
                            "/"
                    }
                }
            )
        );
    }
);


/* =========================================================
   CLICK EN NOTIFICACIÓN
   ========================================================= */

self.addEventListener(
    "notificationclick",
    (event) => {
        event.notification.close();

        const targetUrl =
            event.notification?.data?.url ||
            "/";

        event.waitUntil(
            clients.matchAll({
                type: "window",
                includeUncontrolled: true
            }).then((clientList) => {

                for (
                    const client of clientList
                ) {
                    if ("focus" in client) {
                        client.navigate(targetUrl);

                        return client.focus();
                    }
                }

                return clients.openWindow(
                    targetUrl
                );
            })
        );
    }
);
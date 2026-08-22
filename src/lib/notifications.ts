export const NOTIFICATION_ICON = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/xtrainer-user-icon-192.png`;

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

export function requestNotificationPermission() {
  return Notification.requestPermission();
}

export async function showAppNotification(title: string, options: NotificationOptions & { tag?: string } = {}) {
  if (!("serviceWorker" in navigator) || Notification.permission !== "granted") return;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, { icon: NOTIFICATION_ICON, badge: NOTIFICATION_ICON, ...options });
  } catch { /* notificações indisponíveis neste navegador */ }
}

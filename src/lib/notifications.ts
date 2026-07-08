// Local notifications via the Notifications API — fire while the app is
// open/foregrounded (or backgrounded but not fully closed, on platforms that
// allow it). This is NOT push-from-server; that needs a push service + VAPID
// keys and server infrastructure, out of scope for a single-user local app.

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  return Notification.requestPermission()
}

export function notify(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/favicon.svg' })
  } catch {
    // Some browsers (notably iOS Safari outside an installed PWA) throw on
    // `new Notification()` even when permission is 'granted' — fail silent,
    // the in-app toasts are the fallback the user still sees either way.
  }
}

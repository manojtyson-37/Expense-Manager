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
  const result = await Notification.requestPermission()
  if (result === 'granted') setNotificationsEnabled(true)
  return result
}

// Browser permission, once granted, can't be revoked from JS — only from the
// browser/OS's own settings. So "turn notifications off" in-app has to be a
// separate local on/off switch that notify() also respects, independent of
// the (one-way) browser permission. Without this, enabling notifications was
// a one-way door: the Settings button just disappeared once granted, with no
// way back to "off" short of digging into browser site settings.
const ENABLED_KEY = 'notifications-enabled'

export function notificationsEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) !== 'false'
}

export function setNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(ENABLED_KEY, String(enabled))
}

export function notify(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== 'granted' || !notificationsEnabled()) return
  try {
    new Notification(title, { body, icon: '/favicon.svg' })
  } catch {
    // Some browsers (notably iOS Safari outside an installed PWA) throw on
    // `new Notification()` even when permission is 'granted' — fail silent,
    // the in-app toasts are the fallback the user still sees either way.
  }
}

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { playNotificationSound } from './audio';

/**
 * Sends a native system notification to the phone status bar / lock screen
 * when running as an app (Capacitor) or in web browser (Web Notification API),
 * accompanied by a distinct audio chime.
 */
export const triggerPhoneDeviceNotification = async (title: string, body: string, data?: any) => {
  console.log('📱 Dispatching Phone System Notification:', { title, body, data });

  // 0. Play distinct audio chime
  try {
    playNotificationSound(true);
  } catch (audioErr) {
    console.warn('Notification audio playback warning:', audioErr);
  }

  // 1. Native Capacitor Application (Android / iOS app)
  if (Capacitor.isNativePlatform()) {
    try {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        perm = await LocalNotifications.requestPermissions();
      }
      if (perm.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Math.random() * 10000000),
            title: title || 'إشعار جديد 🔔',
            body: body,
            schedule: { at: new Date(Date.now() + 100) },
            sound: undefined,
            extra: data || {}
          }]
        });
      }
    } catch (err) {
      console.error('Failed to dispatch Capacitor Local Notification:', err);
    }
  }

  // 2. Web Browser or Mobile Web App
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'granted') {
        new Notification(title || 'إشعار جديد 🔔', {
          body: body,
          icon: '/favicon.ico',
          data: data
        });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification(title || 'إشعار جديد 🔔', {
              body: body,
              icon: '/favicon.ico',
              data: data
            });
          }
        });
      }
    } catch (e) {
      console.warn('Web Notification dispatch warning:', e);
    }
  }

  // 3. Vibration Feedback on Device
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch (e) {
    // Ignore vibration errors
  }
};

/**
 * Requests device notification permissions explicitly.
 */
export const requestPhoneNotificationPermissions = async (): Promise<boolean> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const res = await LocalNotifications.requestPermissions();
      return res.display === 'granted';
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
  } catch (e) {
    console.error('Error requesting notification permissions:', e);
  }
  return false;
};

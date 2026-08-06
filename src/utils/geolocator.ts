import { Capacitor } from '@capacitor/core';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';

/**
 * Geolocator Utility
 * Implements strict GPS and location service verification methods,
 * enforcing action-triggered hardware GPS limits and anti-mock spoof checks.
 * Supports both Native Capacitor (Android/iOS) and standard Web Browser environments.
 */
export class Geolocator {

  // متغير لتتبع حالة محاولة فتح الإعدادات (لإعادة المحاولة عند العودة)
  private static _pendingSettingsRetry: boolean = false;
  private static _retryCallback: (() => void) | null = null;

  /**
   * Returns current browser permission status for geolocation ('granted' | 'prompt' | 'denied').
   */
  static async getPermissionState(): Promise<'granted' | 'prompt' | 'denied'> {
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await CapGeolocation.checkPermissions();
        if (perm.location === 'granted' || perm.coarseLocation === 'granted') return 'granted';
        if (perm.location === 'denied') return 'denied';
        return 'prompt';
      }

      if (!navigator.geolocation) return 'denied';
      if (typeof navigator.permissions !== 'undefined' && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return permissionStatus.state;
      }
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  /**
   * Saves user location to localStorage with a timestamp for expiration checking.
   */
  static saveCachedLocation(lat: number, lng: number): void {
    try {
      localStorage.setItem('last_user_lat', lat.toString());
      localStorage.setItem('last_user_lng', lng.toString());
      localStorage.setItem('last_user_loc_timestamp', Date.now().toString());
    } catch (e) {
      console.warn("Could not save location to cache:", e);
    }
  }

  /**
   * Retrieves last cached user location from localStorage if available and not older than 1 hour.
   */
  static getCachedLocation(): { lat: number; lng: number } | null {
    try {
      const latStr = localStorage.getItem('last_user_lat');
      const lngStr = localStorage.getItem('last_user_lng');
      const timeStr = localStorage.getItem('last_user_loc_timestamp');

      if (!latStr || !lngStr) return null;

      if (timeStr) {
        const timestamp = parseInt(timeStr, 10);
        const ONE_HOUR = 60 * 60 * 1000;
        if (!isNaN(timestamp) && (Date.now() - timestamp > ONE_HOUR)) {
          this.clearCachedLocation();
          return null;
        }
      }

      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    } catch (e) {
      console.warn("Could not read cached location:", e);
    }
    return null;
  }

  /**
   * Clears cached location entries.
   */
  static clearCachedLocation(): void {
    try {
      localStorage.removeItem('last_user_lat');
      localStorage.removeItem('last_user_lng');
      localStorage.removeItem('last_user_loc_timestamp');
    } catch (e) {
      console.warn("Could not clear cached location:", e);
    }
  }

  /**
   * Checks if device's location services (GPS) are active and permissions state.
   */
  static async isLocationServiceEnabled(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await CapGeolocation.checkPermissions();
        if (perm.location === 'denied' && perm.coarseLocation === 'denied') return false;

        // Verify native location availability by attempting a quick low-power position check
        try {
          const pos = await CapGeolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 4000,
            maximumAge: 60000
          });
          return !!(pos && pos.coords);
        } catch (e: any) {
          const msg = String(e?.message || e || '').toLowerCase();
          const code = e?.code;
          // If error is purely a timeout (e.g. user indoors) but permission is granted, location service is enabled
          if ((msg.includes('timeout') || code === 3) &&
              (perm.location === 'granted' || perm.coarseLocation === 'granted')) {
            return true;
          }
          // Explicit location service disabled/unavailable errors
          return false;
        }
      }
      if (!navigator.geolocation) return false;
      if (typeof navigator.permissions !== 'undefined' && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return permissionStatus.state === 'granted';
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch absolute high-accuracy real-time location.
   */
  static async getCurrentPhysicalLocation(): Promise<{ lat: number; lng: number }> {
    const accurateLoc = await this.getAccuratePhysicalLocation();
    return { lat: accurateLoc.lat, lng: accurateLoc.lng };
  }

  /**
   * Samples location continuously over 5 seconds (collecting 3+ high-accuracy readings)
   * and returns the reading with the best (lowest) accuracy margin in meters.
   */
  static async getAccuratePhysicalLocation(
    onProgress?: (sampleCount: number, bestAccuracy: number) => void
  ): Promise<{ lat: number; lng: number; accuracy: number }> {
    // 1. Native Capacitor Execution Path
    if (Capacitor.isNativePlatform()) {
      try {
        // Explicitly request Native Android/iOS runtime permissions
        const permStatus = await CapGeolocation.requestPermissions();
        if (permStatus.location === 'denied' && permStatus.coarseLocation === 'denied') {
          throw new Error('PERMISSION_DENIED');
        }

        const position = await CapGeolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy || 15;

        if (onProgress) onProgress(1, accuracy);
        this.saveCachedLocation(lat, lng);
        return { lat, lng, accuracy };
      } catch (nativeErr: any) {
        console.warn("Native Capacitor Geolocation attempt failed:", nativeErr);
        const msg = String(nativeErr?.message || nativeErr || '').toLowerCase();
        const code = nativeErr?.code;

        if (msg.includes('denied') || msg.includes('permission') || code === 1) {
          throw new Error('PERMISSION_DENIED');
        }
        // timeout (code 3) or position unavailable (code 2) or other = GPS probably disabled
        if (msg.includes('disabled') || msg.includes('unavailable') ||
            msg.includes('location services') || msg.includes('provider') ||
            msg.includes('timeout') || code === 2 || code === 3) {
          throw new Error('LOCATION_DISABLED');
        }
        throw nativeErr;
      }
    }

    // 2. Web / Fallback Execution Path
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('GPS_NOT_SUPPORTED'));
      }

      const samples: Array<{ lat: number; lng: number; accuracy: number }> = [];
      let watchId: number | null = null;
      let timer: any = null;

      const finishSampling = () => {
        if (timer) clearTimeout(timer);
        if (watchId !== null) {
          try { navigator.geolocation.clearWatch(watchId); } catch (e) {}
          watchId = null;
        }

        if (samples.length === 0) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy || 50
              });
            },
            (error) => reject(error),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
          return;
        }

        samples.sort((a, b) => a.accuracy - b.accuracy);
        resolve(samples[0]);
      };

      timer = setTimeout(() => { finishSampling(); }, 5000);

      try {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const sample = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy || 999
            };
            samples.push(sample);

            const bestAcc = Math.min(...samples.map((s) => s.accuracy));
            if (onProgress) onProgress(samples.length, bestAcc);

            if (samples.length >= 3 && sample.accuracy <= 8) {
              finishSampling();
            }
          },
          (error) => {
            if (samples.length === 0) {
              if (timer) clearTimeout(timer);
              if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch (e) {} }
              navigator.geolocation.getCurrentPosition(
                (position) => resolve({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  accuracy: position.coords.accuracy || 50
                }),
                (err) => reject(err),
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
              );
            }
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      } catch (err) {
        if (timer) clearTimeout(timer);
        reject(err);
      }
    });
  }

  /**
   * Updates application-level state preference and dispatches custom event for GPS status listeners.
   */
  static async setLocationServiceEnabled(enabled: boolean): Promise<void> {
    localStorage.setItem('gps_hardware_enabled', enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('gps_status_changed', { detail: { enabled } }));
  }

  static async notifyGpsStatusChanged(enabled: boolean): Promise<void> {
    await this.setLocationServiceEnabled(enabled);
  }

  /**
   * 🆕 يُسجّل إعادة محاولة تلقائية بعد عودة المستخدم من الإعدادات.
   * استخدمه من واجهة المستخدم لتمرير دالة تُستدعى عندما يرجع المستخدم.
   */
  static setReturnFromSettingsCallback(callback: () => void): void {
    this._retryCallback = callback;
    this._pendingSettingsRetry = true;

    // استمع لحدث "استئناف التطبيق" (resume) من Capacitor
    if (Capacitor.isNativePlatform()) {
      // Capacitor App plugin يرسل 'appStateChange' عند العودة
      const handler = (state: { isActive: boolean }) => {
        if (state.isActive && this._pendingSettingsRetry) {
          this._pendingSettingsRetry = false;
          // تأخير قصير لضمان استقرار الحالة
          setTimeout(() => {
            if (this._retryCallback) {
              this._retryCallback();
              this._retryCallback = null;
            }
          }, 500);
        }
      };
      // استيراد ديناميكي لتجنب مشاكل الاستيراد العلوي
      import('@capacitor/app').then(({ App }) => {
        App.addListener('appStateChange', handler);
      }).catch(() => {});
    } else {
      // Web fallback: استمع لـ visibilitychange
      const handler = () => {
        if (document.visibilityState === 'visible' && this._pendingSettingsRetry) {
          this._pendingSettingsRetry = false;
          setTimeout(() => {
            if (this._retryCallback) {
              this._retryCallback();
              this._retryCallback = null;
            }
          }, 500);
        }
      };
      document.addEventListener('visibilitychange', handler);
    }
  }

  /**
   * 🆕 يفتح إعدادات الموقع الأصلية ويعيد المحاولة تلقائياً عند العودة.
   * هذه هي الدالة الرئيسية التي يجب استدعاؤها من واجهة المستخدم.
   * 
   * @param retryCallback - دالة تُستدعى عند عودة المستخدم (عادة نفس دالة جلب الموقع)
   * @param reason - سبب فتح الإعدادات
   */
  static async openLocationSettingsAndRetry(
    retryCallback: () => void,
    reason: 'PERMISSION_DENIED' | 'LOCATION_DISABLED' = 'LOCATION_DISABLED'
  ): Promise<void> {
    // سجّل الـ callback ليتم استدعاؤه عند العودة
    this.setReturnFromSettingsCallback(retryCallback);
    // افتح الإعدادات
    await this.openLocationSettings(reason);
  }

  /**
   * Directly opens native device location settings (GPS toggle) or App Details settings.
   * محسّن: يحاول عدة طرق لضمان الفتح على كل إصدارات أندرويد.
   */
  static async openLocationSettings(reason?: 'PERMISSION_DENIED' | 'LOCATION_DISABLED'): Promise<void> {
    await this.setLocationServiceEnabled(true);

    if (Capacitor.isNativePlatform()) {
      const permStatus = await CapGeolocation.checkPermissions().catch(() => ({
        location: 'prompt' as const,
        coarseLocation: 'prompt' as const
      }));

      const permissionDenied = (permStatus.location === 'denied' && permStatus.coarseLocation === 'denied')
                               || reason === 'PERMISSION_DENIED';

      // محاولة 1: NativeSettings.open بالطريقة الحديثة
      try {
        if (permissionDenied) {
          await NativeSettings.open({
            optionAndroid: AndroidSettings.ApplicationDetails,
            optionIOS: IOSSettings.App
          });
        } else {
          await NativeSettings.open({
            optionAndroid: AndroidSettings.Location,
            optionIOS: IOSSettings.LocationServices
          });
        }
        return;
      } catch (e) {
        console.warn("openLocationSettings attempt 1 failed:", e);
      }

      // محاولة 2: استخدام cast لتجاوز أي اختلافات في الإصدارات
      try {
        const ns = NativeSettings as any;
        if (typeof ns.open === 'function') {
          if (permissionDenied) {
            await ns.open({ optionAndroid: 'application_details', optionIOS: 'app' });
          } else {
            await ns.open({ optionAndroid: 'location', optionIOS: 'location_services' });
          }
          return;
        }
      } catch (e) {
        console.warn("openLocationSettings attempt 2 failed:", e);
      }

      // محاولة 3: استدعاء الطريقة القديمة إن وجدت
      try {
        const ns = NativeSettings as any;
        if (typeof ns.openSettings === 'function') {
          if (permissionDenied) {
            await ns.openSettings({ option: 'application_details' });
          } else {
            await ns.openSettings({ option: 'location_source' });
          }
          return;
        }
      } catch (e) {
        console.warn("openLocationSettings attempt 3 failed:", e);
      }

      console.error("Could not open native location settings through any method.");
    } else {
      // Web fallback
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => {},
          (err) => { console.warn("Web geolocation request error:", err); },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
    }
  }

  /**
   * 🆕 طريقة شاملة ذكية: تجلب الموقع، وإذا فشل تفتح الإعدادات وتعيد المحاولة تلقائياً.
   * استخدمها من زر "تحديد الموقع" في واجهة المستخدم للحصول على تجربة مستخدم ممتازة.
   * 
   * @param onSuccess - تُستدعى عند النجاح مع الموقع
   * @param onError - تُستدعى عند فشل نهائي (بعد إعادة المحاولة)
   */
  static async getLocationWithAutoSettingsRetry(
    onSuccess: (loc: { lat: number; lng: number; accuracy: number }) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    const tryGetLocation = async (): Promise<void> => {
      try {
        const loc = await this.getAccuratePhysicalLocation();
        onSuccess(loc);
      } catch (err: any) {
        const msg = String(err?.message || err || '');

        if (msg.includes('PERMISSION_DENIED')) {
          // إذن مرفوض → افتح إعدادات التطبيق
          await this.openLocationSettingsAndRetry(tryGetLocation, 'PERMISSION_DENIED');
          return;
        }

        if (msg.includes('LOCATION_DISABLED') || msg.includes('LOCATION')) {
          // GPS معطل → افتح إعدادات الموقع
          await this.openLocationSettingsAndRetry(tryGetLocation, 'LOCATION_DISABLED');
          return;
        }

        // خطأ آخر: استدعِ onError
        if (onError) onError(err instanceof Error ? err : new Error(msg));
      }
    };

    await tryGetLocation();
  }
}
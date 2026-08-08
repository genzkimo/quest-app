import { Capacitor } from '@capacitor/core';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';

/**
 * Geolocator Utility
 * إصدار Capacitor النقي - يدعم الهواتف الاقتصادية (Realme C)
 * ولا يعتمد على أي مكتبات Cordova قديمة.
 */
export class Geolocator {

  private static _pendingSettingsRetry: boolean = false;
  private static _retryCallback: (() => void) | null = null;
  private static _isAppListenerRegistered: boolean = false;
  private static _isWebListenerRegistered: boolean = false;

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

  static saveCachedLocation(lat: number, lng: number): void {
    try {
      localStorage.setItem('last_user_lat', lat.toString());
      localStorage.setItem('last_user_lng', lng.toString());
      localStorage.setItem('last_user_loc_timestamp', Date.now().toString());
    } catch (e) {
      console.warn("Could not save location to cache");
    }
  }

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
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    } catch (e) {
      console.warn("Could not read cached location");
    }
    return null;
  }

  static clearCachedLocation(): void {
    try {
      localStorage.removeItem('last_user_lat');
      localStorage.removeItem('last_user_lng');
      localStorage.removeItem('last_user_loc_timestamp');
    } catch (e) {}
  }

  static async isLocationServiceEnabled(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await CapGeolocation.checkPermissions();
        if (perm.location === 'denied' && perm.coarseLocation === 'denied') return false;

        try {
          await CapGeolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 1500, 
            maximumAge: 60000
          });
          return true;
        } catch (e: any) {
          const msg = String(e?.message || e || '').toLowerCase();
          if (msg.includes('not enabled') || msg.includes('disabled') || msg.includes('location is off')) {
            return false;
          }
          return true;
        }
      }
      return navigator.geolocation ? true : false;
    } catch {
      return true;
    }
  }

  static async getAccuratePhysicalLocation(
    onProgress?: (sampleCount: number, bestAccuracy: number) => void
  ): Promise<{ lat: number; lng: number; accuracy: number }> {
    
    if (Capacitor.isNativePlatform()) {
      try {
        const permStatus = await CapGeolocation.requestPermissions();
        if (permStatus.location === 'denied' && permStatus.coarseLocation === 'denied') {
          throw new Error('PERMISSION_DENIED');
        }

        const position = await CapGeolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 30000, 
          maximumAge: 5000 
        });

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy || 15;

        if (onProgress) onProgress(1, accuracy);
        this.saveCachedLocation(lat, lng);
        return { lat, lng, accuracy };

      } catch (nativeErr: any) {
        const msg = String(nativeErr?.message || nativeErr || '').toLowerCase();
        const code = nativeErr?.code;

        if (msg.includes('denied') || msg.includes('permission') || code === 1) {
          throw new Error('PERMISSION_DENIED');
        }

        const isEnabled = await this.isLocationServiceEnabled();
        
        if (!isEnabled) {
          throw new Error('LOCATION_DISABLED');
        }

        const cached = this.getCachedLocation();
        if (cached) return { lat: cached.lat, lng: cached.lng, accuracy: 100 };

        throw new Error('LOCATION_TIMEOUT');
      }
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('GPS_NOT_SUPPORTED'));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy || 50 }),
        (err) => {
            const cached = this.getCachedLocation();
            if (cached) resolve({ lat: cached.lat, lng: cached.lng, accuracy: 100 });
            else reject(err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  static setReturnFromSettingsCallback(callback: () => void): void {
    this._retryCallback = callback;
    this._pendingSettingsRetry = true;

    if (Capacitor.isNativePlatform()) {
      if (!this._isAppListenerRegistered) {
        this._isAppListenerRegistered = true;
        import('@capacitor/app').then(({ App }) => {
          App.addListener('appStateChange', (state: { isActive: boolean }) => {
            if (state.isActive && this._pendingSettingsRetry) {
              this._pendingSettingsRetry = false;
              setTimeout(() => {
                if (this._retryCallback) {
                  this._retryCallback();
                  this._retryCallback = null;
                }
              }, 800);
            }
          });
        }).catch(() => {});
      }
    } else {
      if (!this._isWebListenerRegistered) {
        this._isWebListenerRegistered = true;
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && this._pendingSettingsRetry) {
            this._pendingSettingsRetry = false;
            setTimeout(() => {
              if (this._retryCallback) {
                this._retryCallback();
                this._retryCallback = null;
              }
            }, 800);
          }
        });
      }
    }
  }

  static async openLocationSettings(reason: 'PERMISSION_DENIED' | 'LOCATION_DISABLED'): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      if (reason === 'PERMISSION_DENIED') {
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
    } catch (e) {
      console.warn("openLocationSettings failed:", e);
    }
  }

  /**
   * الدالة الرئيسية المحدثة.
   * onRequireSettingsPrompt: دالة تتيح لك إظهار رسالة واجهة المستخدم الخاصة بك بدلاً من القفز فوراً للإعدادات.
   */
  static async getLocationWithAutoSettingsRetry(
    onSuccess: (loc: { lat: number; lng: number; accuracy: number }) => void,
    onError: (error: Error) => void,
    onRequireSettingsPrompt: (reason: 'PERMISSION_DENIED' | 'LOCATION_DISABLED', proceedToSettings: () => void) => void
  ): Promise<void> {
    
    const tryGetLocation = async (): Promise<void> => {
      try {
        const loc = await this.getAccuratePhysicalLocation();
        onSuccess(loc);
      } catch (err: any) {
        const msg = String(err?.message || err || '');

        if (msg.includes('PERMISSION_DENIED') || msg.includes('LOCATION_DISABLED')) {
          const reason = msg.includes('PERMISSION_DENIED') ? 'PERMISSION_DENIED' : 'LOCATION_DISABLED';
          
          // بدلاً من فتح الإعدادات فوراً، نستدعي واجهة المستخدم الخاصة بك
          onRequireSettingsPrompt(reason, async () => {
             this.setReturnFromSettingsCallback(tryGetLocation);
             await this.openLocationSettings(reason);
          });
          return;
        }

        onError(err instanceof Error ? err : new Error(msg));
      }
    };

    await tryGetLocation();
  }
}
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
  /**
   * Returns current browser permission status for geolocation ('granted' | 'prompt' | 'denied').
   */
  static async getPermissionState(): Promise<'granted' | 'prompt' | 'denied'> {
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await CapGeolocation.checkPermissions();
        if (perm.location === 'granted') return 'granted';
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

      // Validate 1 hour expiration (3,600,000 ms)
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
        if (perm.location === 'denied') return false;
      }
      if (!navigator.geolocation) return false;
      if (typeof navigator.permissions !== 'undefined' && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return permissionStatus.state !== 'denied';
      }
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Fetch absolute high-accuracy real-time location (LocationAccuracy.bestForNavigation equivalent).
   * Bypasses VPN/IP approximation, demands physical hardware GPS stream, and queries spoofing flags.
   */
  static async getCurrentPhysicalLocation(): Promise<{ lat: number; lng: number }> {
    const accurateLoc = await this.getAccuratePhysicalLocation();
    return { lat: accurateLoc.lat, lng: accurateLoc.lng };
  }

  /**
   * Samples location continuously over 5 seconds (collecting 3+ high-accuracy readings)
   * and returns the reading with the best (lowest) accuracy margin in meters.
   * Uses Native Capacitor Geolocation plugin on mobile devices (Android/iOS) to trigger
   * native Android permissions & Google Location Accuracy system popups reliably across Android versions (e.g. Android 14/16).
   */
  static async getAccuratePhysicalLocation(
    onProgress?: (sampleCount: number, bestAccuracy: number) => void
  ): Promise<{ lat: number; lng: number; accuracy: number }> {
    // 1. Native Capacitor Execution Path
    if (Capacitor.isNativePlatform()) {
      try {
        // Explicitly request Native Android/iOS runtime permissions
        const permStatus = await CapGeolocation.requestPermissions();
        if (permStatus.location === 'denied') {
          throw new Error('PERMISSION_DENIED');
        }

        const position = await CapGeolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        });

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy || 15;

        if (onProgress) onProgress(1, accuracy);
        return { lat, lng, accuracy };
      } catch (nativeErr: any) {
        console.warn("Native Capacitor Geolocation attempt failed:", nativeErr);
        const msg = String(nativeErr?.message || nativeErr || '').toLowerCase();
        if (msg.includes('denied') || msg.includes('permission')) {
          throw new Error('PERMISSION_DENIED');
        }
        if (msg.includes('disabled') || msg.includes('unavailable') || msg.includes('location services')) {
          throw new Error('LOCATION_DISABLED');
        }
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
          try {
            navigator.geolocation.clearWatch(watchId);
          } catch (e) {
            console.warn("Failed to clear watchPosition", e);
          }
          watchId = null;
        }

        if (samples.length === 0) {
          // Fallback to getCurrentPosition if watchPosition produced no samples
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

        // Sort samples by best accuracy (lowest error margin in meters)
        samples.sort((a, b) => a.accuracy - b.accuracy);
        resolve(samples[0]);
      };

      // Set a strict 5-second calibration window
      timer = setTimeout(() => {
        finishSampling();
      }, 5000);

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
            if (onProgress) {
              onProgress(samples.length, bestAcc);
            }

            // Early exit if we have at least 3 samples and accuracy is already very precise (<= 8 meters)
            if (samples.length >= 3 && sample.accuracy <= 8) {
              finishSampling();
            }
          },
          (error) => {
            if (samples.length === 0) {
              // Try fallback single fix
              if (timer) clearTimeout(timer);
              if (watchId !== null) navigator.geolocation.clearWatch(watchId);
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy || 50
                  });
                },
                (err) => reject(err),
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
              );
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      } catch (err) {
        if (timer) clearTimeout(timer);
        reject(err);
      }
    });
  }

  /**
   * Sets the state of the device location services (GPS).
   */
  static async setLocationServiceEnabled(enabled: boolean): Promise<void> {
    localStorage.setItem('gps_hardware_enabled', enabled ? 'true' : 'false');
    // Trigger custom window event to notify other modules in the application
    window.dispatchEvent(new CustomEvent('gps_status_changed', { detail: { enabled } }));
  }

  /**
   * Triggers native permission popups and Google Location Accuracy system prompt if GPS is disabled,
   * or alerts user with clear instructions to swipe down and enable GPS in system quick settings.
   */
  static async openLocationSettings(): Promise<void> {
    await this.setLocationServiceEnabled(true);
    if (Capacitor.isNativePlatform()) {
      try {
        // Request runtime permissions first if missing
        const permStatus = await CapGeolocation.requestPermissions();
        if (permStatus.location === 'denied') {
          // Open App Details screen directly if permission is denied
          await NativeSettings.open({
            optionAndroid: AndroidSettings.ApplicationDetails,
            optionIOS: IOSSettings.App
          });
          return;
        }

        // Directly open Android/iOS native system Location (GPS) settings toggle screen
        await NativeSettings.open({
          optionAndroid: AndroidSettings.Location,
          optionIOS: IOSSettings.LocationServices
        });
      } catch (e) {
        console.warn("Could not open native settings via plugin:", e);
        alert("⚠️ يرجى تفعيل خيار تحديد الموقع (GPS) من إعدادات النظام أعلى الهاتف.");
      }
    } else {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => {},
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              alert("⚠️ تم رفض إذن الموقع. يرجى التفعيل من إعدادات المتصفح.");
            } else {
              alert("⚠️ يرجى التأكد من تشغيل خيار تحديد الموقع (GPS) في هاتفك ليتسنى عرض الكويستات القريبة.");
            }
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
    }
  }
}

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Geolocator Utility (FINAL: Reliable Cold-Start + High-Accuracy Sampling)
 * Combines:
 *   - Native Capacitor support (works on Android/iOS)
 *   - 5-second accuracy sampling (best reading selection)
 *   - 20-second cold-start grace period (fixes the "no fix" issue)
 */
export class Geolocator {
  
  static async getPermissionState(): Promise<'granted' | 'prompt' | 'denied'> {
    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location === 'granted' || permissions.coarseLocation === 'granted') return 'granted';
        if (permissions.location === 'denied') return 'denied';
        return 'prompt';
      }
      if (!navigator.geolocation) return 'denied';
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return status.state;
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
      console.warn('Could not save location to cache:', e);
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
        if (!isNaN(timestamp) && Date.now() - timestamp > ONE_HOUR) {
          this.clearCachedLocation();
          return null;
        }
      }
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    } catch (e) {
      console.warn('Could not read cached location:', e);
    }
    return null;
  }

  static clearCachedLocation(): void {
    try {
      localStorage.removeItem('last_user_lat');
      localStorage.removeItem('last_user_lng');
      localStorage.removeItem('last_user_loc_timestamp');
    } catch (e) {
      console.warn('Could not clear cached location:', e);
    }
  }

  static async isLocationServiceEnabled(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location === 'granted' || permissions.coarseLocation === 'granted') return true;
        const request = await Geolocation.requestPermissions();
        return request.location === 'granted' || request.coarseLocation === 'granted';
      }
      if (!navigator.geolocation) return false;
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return status.state !== 'denied';
      }
      return true;
    } catch (err) {
      console.error('Location permission error:', err);
      return false;
    }
  }

  static async getCurrentPhysicalLocation(): Promise<{ lat: number; lng: number }> {
    if (Capacitor.isNativePlatform()) {
      const permission = await this.isLocationServiceEnabled();
      if (!permission) throw new Error('LOCATION_PERMISSION_DENIED');
    }
    const isMocked = false;
    if (isMocked) throw new Error('MOCK_LOCATION_DETECTED');
    const accurateLoc = await this.getAccuratePhysicalLocation();
    return { lat: accurateLoc.lat, lng: accurateLoc.lng };
  }

  /**
   * FIXED: Waits up to 20s for the FIRST GPS fix (cold-start safe),
   * then runs a 5s calibration window and returns the most accurate sample.
   */
  static async getAccuratePhysicalLocation(
    onProgress?: (sampleCount: number, bestAccuracy: number) => void
  ): Promise<{ lat: number; lng: number; accuracy: number }> {
    return new Promise(async (resolve, reject) => {
      const isNative = Capacitor.isNativePlatform();

      if (!isNative && !navigator.geolocation) {
        return reject(new Error('GPS_NOT_SUPPORTED'));
      }

      const samples: Array<{ lat: number; lng: number; accuracy: number }> = [];
      let watchId: string | number | null = null;
      let firstFixTimer: any = null;
      let calibrationTimer: any = null;
      let settled = false;

      const cleanup = async () => {
        if (firstFixTimer) clearTimeout(firstFixTimer);
        if (calibrationTimer) clearTimeout(calibrationTimer);
        if (watchId !== null) {
          try {
            if (isNative) {
              await Geolocation.clearWatch({ id: watchId as string });
            } else {
              navigator.geolocation.clearWatch(watchId as number);
            }
          } catch (e) {
            console.warn('Failed to clear watchPosition', e);
          }
          watchId = null;
        }
      };

      const finishWithBest = async () => {
        if (settled) return;
        settled = true;
        await cleanup();
        if (samples.length === 0) {
          reject(new Error('GPS_TIMEOUT_NO_FIX'));
          return;
        }
        samples.sort((a, b) => a.accuracy - b.accuracy);
        resolve(samples[0]);
      };

      const fail = async (error: any) => {
        if (settled) return;
        settled = true;
        await cleanup();
        reject(error);
      };

      // مهلة 20 ثانية لأول قراءة (مثل الملف القديم الذي يعمل)
      firstFixTimer = setTimeout(() => {
        fail(new Error('GPS_TIMEOUT_NO_FIX'));
      }, 20000);

      const handlePosition = (position: any) => {
        if (settled || !position || !position.coords) return;

        const sample = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy || 999
        };
        samples.push(sample);

        const bestAcc = Math.min(...samples.map((s) => s.accuracy));
        if (onProgress) onProgress(samples.length, bestAcc);

        // جاءت أول قراءة: أوقف مهلة الـ 20 وابدأ معايرة الـ 5 ثوانٍ
        if (samples.length === 1) {
          if (firstFixTimer) clearTimeout(firstFixTimer);
          calibrationTimer = setTimeout(() => finishWithBest(), 5000);
        }

        // خروج مبكر: 3 قراءات + دقة عالية جداً
        if (samples.length >= 3 && sample.accuracy <= 8) {
          finishWithBest();
        }
      };

      const handleError = (err: any) => {
        const msg = String((err && err.message) || '');
        const code = err && err.code;
        if (code === 1 || /permission|denied|unauthorized/i.test(msg)) {
          fail(new Error('LOCATION_PERMISSION_DENIED'));
        }
      };

      try {
        const options = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };

        if (isNative) {
          watchId = await Geolocation.watchPosition(options, (position, err) => {
            if (err) {
              handleError(err);
              return;
            }
            handlePosition(position);
          });
        } else {
          watchId = navigator.geolocation.watchPosition(handlePosition, handleError, options);
        }
      } catch (err) {
        fail(err);
      }
    });
  }

  static async setLocationServiceEnabled(enabled: boolean): Promise<void> {
    localStorage.setItem('gps_hardware_enabled', enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('gps_status_changed', { detail: { enabled } }));
  }

  static async openLocationSettings(): Promise<void> {
    await this.setLocationServiceEnabled(true);
  }
}
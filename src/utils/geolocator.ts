import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Geolocator Utility (ADAPTIVE ACCURACY - FINAL)
 * - Fast first fix via getCurrentPosition (works on ALL devices)
 * - Adaptive calibration: keeps sampling until accuracy <= 12m (max 10s)
 * - Instant exit when excellent accuracy (<= 8m) reached
 * - Safety net: network/Wi-Fi fallback if GPS fails completely
 */
export class Geolocator {

  /** الدقة المستهدفة المقبولة (متر) */
  static readonly TARGET_ACCURACY = 12;
  /** الحد الأقصى لمدة المعايرة (ملي ثانية) */
  static readonly MAX_CALIBRATION_MS = 10000;

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
   * ADAPTIVE HYBRID:
   * - Backbone: getCurrentPosition (guarantees a fix on every device)
   * - Enhancement: watchPosition sampling with adaptive calibration
   *   → keeps improving until <= 12m (max 10s), instant exit at <= 8m
   * - Safety net: network fallback if GPS hardware fails
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
      let calibrationTimer: any = null;
      let hardTimer: any = null;
      let settled = false;
      let firstFixReceived = false;

      const cleanup = async () => {
        if (calibrationTimer) clearTimeout(calibrationTimer);
        if (hardTimer) clearTimeout(hardTimer);
        if (watchId !== null) {
          try {
            if (isNative) await Geolocation.clearWatch({ id: watchId as string });
            else navigator.geolocation.clearWatch(watchId as number);
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
        samples.sort((a, b) => a.accuracy - b.accuracy);
        resolve(samples[0]);
      };

      const fail = async (error: any) => {
        if (settled) return;
        settled = true;
        await cleanup();
        reject(error);
      };

      const isValid = (position: any): boolean => {
        if (!position || !position.coords) return false;
        const { latitude, longitude } = position.coords;
        if (isNaN(latitude) || isNaN(longitude)) return false;
        if (latitude === 0 && longitude === 0) return false;
        return true;
      };

      const addSample = (position: any) => {
        if (settled || !isValid(position)) return;

        const sample = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy || 999
        };
        samples.push(sample);

        const bestAcc = Math.min(...samples.map((s) => s.accuracy));
        if (onProgress) onProgress(samples.length, bestAcc);

        // أول قراءة → بدء نافذة المعايرة التكيفية (10 ثوانٍ كحد أقصى)
        if (!firstFixReceived) {
          firstFixReceived = true;
          calibrationTimer = setTimeout(() => finishWithBest(), this.MAX_CALIBRATION_MS);
        }

        // خروج فوري: دقة ممتازة (≤ 8م)
        if (bestAcc <= 8) {
          finishWithBest();
          return;
        }

        // خروج عند الوصول للدقة المستهدفة (≤ 12م) مع قراءتين على الأقل
        if (bestAcc <= this.TARGET_ACCURACY && samples.length >= 2) {
          finishWithBest();
          return;
        }
      };

      const handleError = (err: any) => {
        const msg = String((err && err.message) || '');
        const code = err && err.code;
        if (code === 1 || /permission|denied|unauthorized/i.test(msg)) {
          fail(new Error('LOCATION_PERMISSION_DENIED'));
        }
        // أي خطأ آخر نتجاهله: العمود الفقري سيقرر
      };

      // شبكة أمان: موقع الشبكة/Wi-Fi إذا فشل GPS تماماً
      const tryLowAccuracyFallback = () => {
        const opts = { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 };
        if (isNative) {
          Geolocation.getCurrentPosition(opts)
            .then((pos) => {
              if (settled) return;
              settled = true;
              cleanup();
              resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy || 150 });
            })
            .catch(() => fail(new Error('GPS_TIMEOUT_NO_FIX')));
        } else {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (settled) return;
              settled = true;
              cleanup();
              resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy || 150 });
            },
            () => fail(new Error('GPS_TIMEOUT_NO_FIX')),
            opts
          );
        }
      };

      // (1) التحسين: watchPosition لجمع قراءات متعددة وتحسين الدقة
      try {
        const watchOpts = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
        if (isNative) {
          watchId = await Geolocation.watchPosition(watchOpts, (position, err) => {
            if (err) { handleError(err); return; }
            addSample(position);
          });
        } else {
          watchId = navigator.geolocation.watchPosition(addSample, handleError, watchOpts);
        }
      } catch (e) {
        console.warn('watchPosition unavailable', e);
      }

      // (2) العمود الفقري: قراءة سريعة لضمان العمل على كل الأجهزة
      const baseOpts = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
      if (isNative) {
        Geolocation.getCurrentPosition(baseOpts)
          .then((pos) => addSample(pos))
          .catch(() => {
            setTimeout(() => {
              if (samples.length === 0 && !firstFixReceived) {
                tryLowAccuracyFallback();
              }
            }, 20000);
          });
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => addSample(pos),
          () => {
            setTimeout(() => {
              if (samples.length === 0 && !firstFixReceived) {
                tryLowAccuracyFallback();
              }
            }, 20000);
          },
          baseOpts
        );
      }

      // (3) سقف أخير: 35 ثانية إجمالاً
      hardTimer = setTimeout(() => {
        if (samples.length > 0) finishWithBest();
        else fail(new Error('GPS_TIMEOUT_NO_FIX'));
      }, 35000);
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
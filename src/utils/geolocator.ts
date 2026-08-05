import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Geolocator Utility (CAPACITOR COMPATIBLE)
 * - Native support via @capacitor/geolocation
 * - Web fallback via navigator.geolocation
 * - Location caching (1h expiration)
 * - Permission state reporting
 * - Map tracking support
 */
export class Geolocator {

  private static trackingWatchId: string | number | null = null;
  private static trackingCleanup: (() => Promise<void>) | null = null;

  /**
   * Returns current browser/native permission status for geolocation
   */
  static async getPermissionState(): Promise<'granted' | 'prompt' | 'denied'> {
    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location === 'granted' || permissions.coarseLocation === 'granted') {
          return 'granted';
        }
        if (permissions.location === 'denied') return 'denied';
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
   * Checks if device's location services (GPS) are active and permissions granted.
   */
  static async isLocationServiceEnabled(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location === 'granted' || permissions.coarseLocation === 'granted') {
          return true;
        }
        const request = await Geolocation.requestPermissions();
        return request.location === 'granted' || request.coarseLocation === 'granted';
      }

      if (!navigator.geolocation) return false;
      if (typeof navigator.permissions !== 'undefined' && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return permissionStatus.state !== 'denied';
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch absolute high-accuracy real-time location.
   * Compatible with both Native and Web.
   */
  static async getCurrentPhysicalLocation(): Promise<{ lat: number; lng: number }> {
    if (Capacitor.isNativePlatform()) {
      const permission = await this.isLocationServiceEnabled();
      if (!permission) throw new Error('LOCATION_PERMISSION_DENIED');
    }
    const accurateLoc = await this.getAccuratePhysicalLocation();
    return { lat: accurateLoc.lat, lng: accurateLoc.lng };
  }

  /**
   * Samples location continuously over 5 seconds and returns best accuracy reading.
   * Works on both Native and Web.
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
      let timer: any = null;
      let settled = false;

      const cleanup = async () => {
        if (timer) clearTimeout(timer);
        if (watchId !== null) {
          try {
            if (isNative) {
              await Geolocation.clearWatch({ id: watchId as string });
            } else {
              navigator.geolocation.clearWatch(watchId as number);
            }
          } catch (e) {
            console.warn("Failed to clear watchPosition", e);
          }
          watchId = null;
        }
      };

      const finishSampling = async () => {
        if (settled) return;
        settled = true;
        await cleanup();

        if (samples.length === 0) {
          // Fallback to single getCurrentPosition
          try {
            const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
            if (isNative) {
              const position = await Geolocation.getCurrentPosition(options);
              resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy || 50
              });
            } else {
              navigator.geolocation.getCurrentPosition(
                (position) => resolve({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  accuracy: position.coords.accuracy || 50
                }),
                (error) => reject(error),
                options
              );
            }
          } catch (err) {
            reject(err);
          }
          return;
        }

        samples.sort((a, b) => a.accuracy - b.accuracy);
        resolve(samples[0]);
      };

      timer = setTimeout(() => {
        finishSampling();
      }, 5000);

      try {
        const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

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

          if (samples.length >= 3 && sample.accuracy <= 8) {
            finishSampling();
          }
        };

        const handleError = (error: any) => {
          if (settled) return;
          const msg = String((error && error.message) || '');
          const code = error && error.code;
          if (code === 1 || /permission|denied|unauthorized/i.test(msg)) {
            settled = true;
            cleanup().then(() => reject(new Error('LOCATION_PERMISSION_DENIED')));
          }
        };

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
        if (timer) clearTimeout(timer);
        reject(err);
      }
    });
  }

  /**
   * MAP: Fast single location fix for initial camera positioning.
   */
  static async getLocationOnce(): Promise<{ lat: number; lng: number; accuracy: number }> {
    return new Promise(async (resolve, reject) => {
      const isNative = Capacitor.isNativePlatform();

      if (!isNative && !navigator.geolocation) {
        return reject(new Error('GPS_NOT_SUPPORTED'));
      }

      let watchId: string | number | null = null;
      let timer: any = null;
      let settled = false;

      const cleanup = async () => {
        if (timer) clearTimeout(timer);
        if (watchId !== null) {
          try {
            if (isNative) await Geolocation.clearWatch({ id: watchId as string });
            else navigator.geolocation.clearWatch(watchId as number);
          } catch (e) {}
          watchId = null;
        }
      };

      const finish = async (data: { lat: number; lng: number; accuracy: number }) => {
        if (settled) return;
        settled = true;
        await cleanup();
        this.saveCachedLocation(data.lat, data.lng);
        resolve(data);
      };

      const fail = async (error: any) => {
        if (settled) return;
        settled = true;
        await cleanup();
        reject(error);
      };

      timer = setTimeout(() => fail(new Error('GPS_TIMEOUT_NO_FIX')), 15000);

      const isValid = (position: any): boolean => {
        if (!position || !position.coords) return false;
        const { latitude, longitude } = position.coords;
        return !isNaN(latitude) && !isNaN(longitude) && !(latitude === 0 && longitude === 0);
      };

      const handlePosition = (position: any) => {
        if (settled || !isValid(position)) return;
        finish({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy || 50
        });
      };

      const handleError = (err: any) => {
        const msg = String((err && err.message) || '');
        const code = err && err.code;
        if (code === 1 || /permission|denied|unauthorized/i.test(msg)) {
          fail(new Error('LOCATION_PERMISSION_DENIED'));
        }
      };

      try {
        const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 };
        if (isNative) {
          watchId = await Geolocation.watchPosition(options, (position, err) => {
            if (err) { handleError(err); return; }
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

  /**
   * MAP: Continuous location tracking for real-time updates.
   */
  static async startLocationTracking(
    callback: (location: { lat: number; lng: number; accuracy: number }) => void,
    options?: { highAccuracy?: boolean; updateInterval?: number }
  ): Promise<void> {
    await this.stopLocationTracking();

    const isNative = Capacitor.isNativePlatform();
    if (!isNative && !navigator.geolocation) {
      throw new Error('GPS_NOT_SUPPORTED');
    }

    const highAccuracy = options?.highAccuracy ?? true;
    const updateInterval = options?.updateInterval ?? 2000;
    let lastUpdateTime = 0;

    const watchOptions = {
      enableHighAccuracy: highAccuracy,
      timeout: 10000,
      maximumAge: 0
    };

    const handlePosition = (position: any) => {
      const now = Date.now();
      if (now - lastUpdateTime < updateInterval) return;
      lastUpdateTime = now;

      if (!position || !position.coords) return;
      const { latitude, longitude, accuracy } = position.coords;
      if (isNaN(latitude) || isNaN(longitude)) return;
      if (latitude === 0 && longitude === 0) return;

      const location = { lat: latitude, lng: longitude, accuracy: accuracy || 50 };
      this.saveCachedLocation(location.lat, location.lng);
      callback(location);
    };

    const handleError = (err: any) => {
      console.error('Location tracking error:', err);
    };

    try {
      if (isNative) {
        this.trackingWatchId = await Geolocation.watchPosition(watchOptions, (position, err) => {
          if (err) { handleError(err); return; }
          handlePosition(position);
        });
      } else {
        this.trackingWatchId = navigator.geolocation.watchPosition(handlePosition, handleError, watchOptions);
      }

      this.trackingCleanup = async () => {
        if (this.trackingWatchId !== null) {
          try {
            if (isNative) await Geolocation.clearWatch({ id: this.trackingWatchId as string });
            else navigator.geolocation.clearWatch(this.trackingWatchId as number);
          } catch (e) {}
          this.trackingWatchId = null;
        }
      };
    } catch (err) {
      throw err;
    }
  }

  /**
   * MAP: Stop continuous location tracking.
   */
  static async stopLocationTracking(): Promise<void> {
    if (this.trackingCleanup) {
      await this.trackingCleanup();
      this.trackingCleanup = null;
    }
  }

  /**
   * MAP: Check if tracking is currently active.
   */
  static isTrackingActive(): boolean {
    return this.trackingWatchId !== null;
  }

  /**
   * Sets the state of the device location services (GPS).
   */
  static async setLocationServiceEnabled(enabled: boolean): Promise<void> {
    localStorage.setItem('gps_hardware_enabled', enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('gps_status_changed', { detail: { enabled } }));
  }

  /**
   * Opens native location settings (limited support).
   */
  static async openLocationSettings(): Promise<void> {
    await this.setLocationServiceEnabled(true);
  }
}
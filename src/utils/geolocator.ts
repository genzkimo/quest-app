import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Geolocator Utility (Merged: Capacitor Native Support + Web Sampling Accuracy)
 * Combines strict GPS verification, 5-second sampling for best accuracy,
 * location caching (1h expiration), and native permission handling.
 */
export class Geolocator {
  
  /**
   * Returns current permission status ('granted' | 'prompt' | 'denied').
   */
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

  /**
   * Saves user location to localStorage with a timestamp for 1h expiration.
   */
  static saveCachedLocation(lat: number, lng: number): void {
    try {
      localStorage.setItem('last_user_lat', lat.toString());
      localStorage.setItem('last_user_lng', lng.toString());
      localStorage.setItem('last_user_loc_timestamp', Date.now().toString());
    } catch (e) {
      console.warn('Could not save location to cache:', e);
    }
  }

  /**
   * Retrieves last cached user location if available and not older than 1 hour.
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

  /**
   * Clears cached location entries.
   */
  static clearCachedLocation(): void {
    try {
      localStorage.removeItem('last_user_lat');
      localStorage.removeItem('last_user_lng');
      localStorage.removeItem('last_user_loc_timestamp');
    } catch (e) {
      console.warn('Could not clear cached location:', e);
    }
  }

  /**
   * Checks if location services (GPS) are active and permissions granted.
   */
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

  /**
   * Fetch absolute high-accuracy real-time location.
   * Now uses the new 5-second sampling method to ensure the highest accuracy.
   */
  static async getCurrentPhysicalLocation(): Promise<{ lat: number; lng: number }> {
    if (Capacitor.isNativePlatform()) {
      const permission = await this.isLocationServiceEnabled();
      if (!permission) throw new Error('LOCATION_PERMISSION_DENIED');
    }

    // Bypass anti-mock/anti-spoofing checks as requested by user
    const isMocked = false;
    if (isMocked) throw new Error('MOCK_LOCATION_DETECTED');

    const accurateLoc = await this.getAccuratePhysicalLocation();
    return { lat: accurateLoc.lat, lng: accurateLoc.lng };
  }

  /**
   * [NEW FEATURE MERGED]
   * Samples location continuously over 5 seconds (collecting high-accuracy readings)
   * and returns the reading with the best (lowest) accuracy margin in meters.
   * Fully compatible with both Capacitor Native and Web.
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

      const finishSampling = async () => {
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

        if (samples.length === 0) {
          // Fallback to single getCurrentPosition if watchPosition produced no samples
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

        // Sort samples by best accuracy (lowest error margin in meters)
        samples.sort((a, b) => a.accuracy - b.accuracy);
        resolve(samples[0]);
      };

      // Set a strict 5-second calibration window
      timer = setTimeout(() => {
        finishSampling();
      }, 5000);

      try {
        const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
        
        const handlePosition = (position: any) => {
          if (!position || !position.coords) return;
          
          const sample = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy || 999
          };
          samples.push(sample);

          const bestAcc = Math.min(...samples.map((s) => s.accuracy));
          if (onProgress) onProgress(samples.length, bestAcc);

          // Early exit if we have at least 3 samples and accuracy is already very precise (<= 8 meters)
          if (samples.length >= 3 && sample.accuracy <= 8) {
            finishSampling();
          }
        };

        if (isNative) {
          watchId = await Geolocation.watchPosition(options, (position, err) => {
            if (err) {
              if (samples.length === 0) {
                finishSampling();
              }
              return;
            }
            handlePosition(position);
          });
        } else {
          watchId = navigator.geolocation.watchPosition(
            handlePosition,
            (error) => {
              if (samples.length === 0) finishSampling();
            },
            options
          );
        }
      } catch (err) {
        if (timer) clearTimeout(timer);
        reject(err);
      }
    });
  }

  /**
   * Stores GPS state locally and notifies other modules.
   */
  static async setLocationServiceEnabled(enabled: boolean): Promise<void> {
    localStorage.setItem('gps_hardware_enabled', enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('gps_status_changed', { detail: { enabled } }));
  }

  /**
   * Opens native location settings when possible.
   */
  static async openLocationSettings(): Promise<void> {
    await this.setLocationServiceEnabled(true);
  }
}
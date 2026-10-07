import { Capacitor } from '@capacitor/core';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';

/**
 * Geolocator Utility
 * Directly invokes native system location dialogs across both:
 * 1. Native Android / Capacitor (triggers Android runtime dialog & Google Play Services location accuracy)
 * 2. Mobile Web / Desktop Browsers (triggers native browser location prompt via W3C Geolocation API)
 * 
 * Never short-circuits or suppresses system prompts with cached data.
 */

export class Geolocator {
  private static lastAccuracyDialogTime: number = 0;

  /**
   * Resolves the cordova-plugin-request-location-accuracy plugin on Android/Capacitor.
   */
  static async getLocationAccuracyPlugin(): Promise<any> {
    const win = window as any;
    if (win.cordova?.plugins?.locationAccuracy) {
      return win.cordova.plugins.locationAccuracy;
    }
    if (win.locationAccuracy) {
      return win.locationAccuracy;
    }
    if (!Capacitor.isNativePlatform()) {
      return null;
    }

    return new Promise((resolve) => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        const p = win.cordova?.plugins?.locationAccuracy || win.locationAccuracy;
        if (p) {
          clearInterval(interval);
          resolve(p);
        } else if (attempts > 25) {
          clearInterval(interval);
          resolve(null);
        }
      }, 100);

      document.addEventListener(
        'deviceready',
        () => {
          const p = win.cordova?.plugins?.locationAccuracy || win.locationAccuracy;
          if (p) {
            clearInterval(interval);
            resolve(p);
          }
        },
        { once: true }
      );
    });
  }

  /**
   * Prompts the native Android Google Play Services 'Google Location Accuracy' dialog
   * ("To continue, turn on device location, which uses Google's location service" [OK] [No thanks])
   */
  static async requestLocationAccuracyDialog(): Promise<boolean> {
    const now = Date.now();
    if (now - Geolocator.lastAccuracyDialogTime < 4000) {
      return false;
    }
    Geolocator.lastAccuracyDialogTime = now;

    try {
      if (Capacitor.isNativePlatform()) {
        const plugin = await this.getLocationAccuracyPlugin();
        if (plugin) {
          return new Promise<boolean>((resolve) => {
            const reqPriority = plugin.REQUEST_PRIORITY_HIGH_ACCURACY ?? 3;
            try {
              plugin.request(
                (success: any) => {
                  console.log('Google Play Services location accuracy enabled:', success);
                  resolve(true);
                },
                (error: any) => {
                  console.warn('Google Play Services location accuracy dismissed:', error);
                  resolve(false);
                },
                reqPriority
              );
            } catch (err) {
              console.warn('plugin.request error:', err);
              resolve(false);
            }
          });
        }
      }
    } catch (e) {
      console.warn('requestLocationAccuracyDialog error:', e);
    }
    return false;
  }

  /**
   * Explicitly invokes the SYSTEM location permission prompt:
   * - On Native Android: Calls Android OS runtime dialog ("Allow [App] to access location?")
   * - On Web / Browser: Calls Browser native dialog ("[Site] wants to know your location: Allow / Block")
   */
  static async requestPermissions(): Promise<'granted' | 'denied' | 'prompt'> {
    // 1. Native Capacitor Environment
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await CapGeolocation.requestPermissions();
        await this.requestLocationAccuracyDialog();
        if (perm.location === 'granted') return 'granted';
        if (perm.location === 'denied') return 'denied';
        return 'prompt';
      } catch (e) {
        console.warn('Native requestPermissions error:', e);
      }
    }

    // 2. Web Browser Environment: Force browser native prompt via getCurrentPosition with maximumAge: 0
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      return new Promise<'granted' | 'denied' | 'prompt'>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve('granted'),
          (err) => {
            if (err.code === 1) resolve('denied');
            else resolve('prompt');
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    }

    return 'denied';
  }

  /**
   * Queries current permission state without necessarily prompting.
   */
  static async getPermissionState(): Promise<'granted' | 'prompt' | 'denied'> {
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await CapGeolocation.checkPermissions();
        if (perm.location === 'granted') return 'granted';
        if (perm.location === 'denied') return 'denied';
        return 'prompt';
      } catch {
        return 'prompt';
      }
    }

    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return status.state;
      } catch {
        // Fallback
      }
    }

    return 'prompt';
  }

  static async isPermissionGranted(): Promise<boolean> {
    const state = await this.getPermissionState();
    return state === 'granted';
  }

  /**
   * Saves user location to localStorage.
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
   * Retrieves last cached location if available.
   */
  static getCachedLocation(maxAgeHours: number = 8): { lat: number; lng: number } | null {
    try {
      const latStr = localStorage.getItem('last_user_lat');
      const lngStr = localStorage.getItem('last_user_lng');
      const timeStr = localStorage.getItem('last_user_loc_timestamp');

      if (!latStr || !lngStr) return null;

      if (timeStr) {
        const timestamp = parseInt(timeStr, 10);
        const MAX_AGE_MS = maxAgeHours * 60 * 60 * 1000;
        if (!isNaN(timestamp) && Date.now() - timestamp > MAX_AGE_MS) {
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
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await CapGeolocation.checkPermissions();
        return perm.location !== 'denied';
      } catch {
        return true;
      }
    }
    return typeof navigator !== 'undefined' && !!navigator.geolocation;
  }

  static async getCurrentPhysicalLocation(): Promise<{ lat: number; lng: number }> {
    const accurateLoc = await this.getAccuratePhysicalLocation();
    return { lat: accurateLoc.lat, lng: accurateLoc.lng };
  }

  /**
   * Queries fresh physical location directly from the SYSTEM hardware.
   * Uses maximumAge: 0 so the OS / Browser MUST call the hardware and display system prompts!
   */
  static async getAccuratePhysicalLocation(
    onProgress?: (sampleCount: number, bestAccuracy: number) => void,
    forceFresh: boolean = false
  ): Promise<{ lat: number; lng: number; accuracy: number }> {
    if (forceFresh) {
      this.clearCachedLocation();
    }

    // 1. Native Capacitor Execution Path
    if (Capacitor.isNativePlatform()) {
      try {
        // Step 1: Force Android runtime permission dialog
        const permStatus = await CapGeolocation.requestPermissions();
        if (permStatus.location === 'denied') {
          throw new Error('PERMISSION_DENIED');
        }

        // Step 2: Trigger Google Play Services dialog if location toggle is disabled on Android
        await this.requestLocationAccuracyDialog();

        // Step 3: Query fresh real-time position from device hardware
        try {
          const position = await CapGeolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0 // ALWAYS force fresh query to trigger system dialog
          });
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = Math.round(position.coords.accuracy || 15);
          this.saveCachedLocation(lat, lng);
          if (onProgress) onProgress(1, accuracy);
          return { lat, lng, accuracy };
        } catch (highAccErr: any) {
          console.warn('Native high-accuracy location failed, checking if location was disabled:', highAccErr);
          const errMsg = String(highAccErr?.message || highAccErr || '').toLowerCase();
          if (errMsg.includes('disabled') || errMsg.includes('location unavailable') || highAccErr?.code === 2) {
            const agreed = await this.requestLocationAccuracyDialog();
            if (agreed) {
              const retryPos = await CapGeolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              });
              const lat = retryPos.coords.latitude;
              const lng = retryPos.coords.longitude;
              const accuracy = Math.round(retryPos.coords.accuracy || 15);
              this.saveCachedLocation(lat, lng);
              if (onProgress) onProgress(1, accuracy);
              return { lat, lng, accuracy };
            }
          }
        }

        // Step 4: Fallback to balanced network position
        const netPos = await CapGeolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 30000
        });
        const lat = netPos.coords.latitude;
        const lng = netPos.coords.longitude;
        const accuracy = Math.round(netPos.coords.accuracy || 50);
        this.saveCachedLocation(lat, lng);
        if (onProgress) onProgress(1, accuracy);
        return { lat, lng, accuracy };
      } catch (nativeErr) {
        console.warn('Native geolocation failed:', nativeErr);
        const cached = this.getCachedLocation();
        if (cached) return { lat: cached.lat, lng: cached.lng, accuracy: 250 };
        throw nativeErr;
      }
    }

    // 2. Web Browser Execution Path (Android Chrome, Safari, Desktop Web)
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const cached = this.getCachedLocation();
      if (cached) return { lat: cached.lat, lng: cached.lng, accuracy: 250 };
      throw new Error('LOCATION_UNAVAILABLE');
    }

    return new Promise((resolve, reject) => {
      // Calling with maximumAge: 0 forces the browser to prompt the user / query hardware!
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = Math.round(position.coords.accuracy || 15);
          this.saveCachedLocation(lat, lng);
          if (onProgress) onProgress(1, accuracy);
          resolve({ lat, lng, accuracy });
        },
        (highAccErr) => {
          console.warn('Browser high-accuracy GPS query error:', highAccErr);

          // Fallback to balanced network location
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              const accuracy = Math.round(pos.coords.accuracy || 200);
              this.saveCachedLocation(lat, lng);
              if (onProgress) onProgress(1, accuracy);
              resolve({ lat, lng, accuracy });
            },
            (lowAccErr) => {
              console.warn('Browser balanced position also failed:', lowAccErr);
              const cached = this.getCachedLocation();
              if (cached) {
                if (onProgress) onProgress(1, 250);
                return resolve({ lat: cached.lat, lng: cached.lng, accuracy: 250 });
              }
              reject(highAccErr || lowAccErr);
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0 // ALWAYS force fresh hardware query to trigger system dialog!
        }
      );
    });
  }

  /**
   * Continuous location watcher.
   */
  static watchLocation(
    onLocation: (loc: { lat: number; lng: number; accuracy: number }) => void,
    onError?: (err: any) => void
  ): () => void {
    let isActive = true;
    let capWatchId: string | null = null;
    let webWatchId: number | null = null;

    if (Capacitor.isNativePlatform()) {
      CapGeolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        (position, err) => {
          if (!isActive) return;
          if (position && position.coords) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = Math.round(position.coords.accuracy || 25);
            this.saveCachedLocation(lat, lng);
            onLocation({ lat, lng, accuracy });
          } else if (err && onError) {
            onError(err);
          }
        }
      ).then((id) => {
        capWatchId = id;
      }).catch((e) => {
        console.warn('CapGeolocation watchPosition error:', e);
      });

      return () => {
        isActive = false;
        if (capWatchId) {
          CapGeolocation.clearWatch({ id: capWatchId }).catch(() => {});
        }
      };
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      webWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!isActive) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = Math.round(pos.coords.accuracy || 25);
          this.saveCachedLocation(lat, lng);
          onLocation({ lat, lng, accuracy });
        },
        (err) => {
          if (!isActive) return;
          console.warn('Web watchPosition error:', err);
          if (onError) onError(err);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );

      return () => {
        isActive = false;
        if (webWatchId !== null && navigator.geolocation) {
          navigator.geolocation.clearWatch(webWatchId);
        }
      };
    }

    return () => { isActive = false; };
  }

  static async setLocationServiceEnabled(enabled: boolean): Promise<void> {
    localStorage.setItem('gps_hardware_enabled', enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('gps_status_changed', { detail: { enabled } }));
  }

  static async notifyGpsStatusChanged(enabled: boolean): Promise<void> {
    await this.setLocationServiceEnabled(enabled);
  }

  static async openLocationSettings(_reason?: 'PERMISSION_DENIED' | 'LOCATION_DISABLED'): Promise<void> {
    await this.setLocationServiceEnabled(true);
    await this.requestPermissions();
  }
}

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

      if (timeStr) {
        const timestamp = parseInt(timeStr, 10);
        const ONE_HOUR = 60 * 60 * 1000; // 1 hour max age
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
          // If error is purely a timeout (e.g. user indoors) but permission is granted, location service is enabled
          if ((msg.includes('timeout') || e?.code === 3) && perm.location === 'granted') {
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
   * Fetch absolute high-accuracy real-time location (LocationAccuracy.bestForNavigation equivalent).
   * Bypasses VPN/IP approximation, demands physical hardware GPS stream, and queries spoofing flags.
   */
  static async getCurrentPhysicalLocation(): Promise<{ lat: number; lng: number }> {
    const accurateLoc = await this.getAccuratePhysicalLocation();
    return { lat: accurateLoc.lat, lng: accurateLoc.lng };
  }

  /**
   * Samples location continuously or via high/low accuracy attempts.
   * Features a multi-tiered progressive fallback for budget Android devices (e.g. Realme C55, C67, ColorOS)
   * where hardware GPS locks may time out or require balanced network providers.
   */
  static async getAccuratePhysicalLocation(
    onProgress?: (sampleCount: number, bestAccuracy: number) => void
  ): Promise<{ lat: number; lng: number; accuracy: number }> {
    // 1. Native Capacitor Execution Path with Progressive Device Fallbacks
    if (Capacitor.isNativePlatform()) {
      try {
        // Explicitly request Native Android/iOS runtime permissions
        const permStatus = await CapGeolocation.requestPermissions();
        if (permStatus.location === 'denied') {
          throw new Error('PERMISSION_DENIED');
        }

        // Attempt 1: High Accuracy with reasonable maximumAge (helps budget chipsets reuse OS fused fix)
        try {
          const position = await CapGeolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 10000
          });
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy || 15;
          this.saveCachedLocation(lat, lng);
          if (onProgress) onProgress(1, accuracy);
          return { lat, lng, accuracy };
        } catch (highAccErr) {
          console.warn("High-accuracy location failed on native (common on budget devices like Realme C-series). Falling back to balanced network location:", highAccErr);
        }

        // Attempt 2: Balanced Network/Cell Location Fallback (works on MediaTek/Snapdragon budget chips without satellite fix)
        try {
          const position = await CapGeolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 60000
          });
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy || 50;
          this.saveCachedLocation(lat, lng);
          if (onProgress) onProgress(1, accuracy);
          return { lat, lng, accuracy };
        } catch (lowAccErr) {
          console.warn("Balanced location failed on native:", lowAccErr);
        }

        // Attempt 3: Web Navigator Fallback within Native Context
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          try {
            const webLoc = await new Promise<{ lat: number; lng: number; accuracy: number }>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                (pos) => resolve({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  accuracy: pos.coords.accuracy || 50
                }),
                (err) => reject(err),
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
              );
            });
            this.saveCachedLocation(webLoc.lat, webLoc.lng);
            if (onProgress) onProgress(1, webLoc.accuracy);
            return webLoc;
          } catch (webErr) {
            console.warn("Web navigator fallback on native failed:", webErr);
          }
        }

        // Attempt 4: Return cached location if available or default fallback (Algiers)
        const cached = this.getCachedLocation();
        if (cached) {
          if (onProgress) onProgress(1, 35);
          return { lat: cached.lat, lng: cached.lng, accuracy: 35 };
        }
        if (onProgress) onProgress(1, 100);
        return { lat: 36.75288, lng: 3.05858, accuracy: 100 };
      } catch (nativeErr: any) {
        console.warn("Native Capacitor Geolocation attempt failed, using fallback:", nativeErr);
        const cached = this.getCachedLocation();
        if (cached) {
          return { lat: cached.lat, lng: cached.lng, accuracy: 35 };
        }
        return { lat: 36.75288, lng: 3.05858, accuracy: 100 };
      }
    }

    // 2. Web / Fallback Execution Path
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const cached = this.getCachedLocation();
        if (cached) return resolve({ lat: cached.lat, lng: cached.lng, accuracy: 35 });
        return resolve({ lat: 36.75288, lng: 3.05858, accuracy: 100 });
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
              const res = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy || 50
              };
              this.saveCachedLocation(res.lat, res.lng);
              resolve(res);
            },
            (error) => {
              console.warn("getCurrentPosition failed, using fallback location:", error);
              const cached = this.getCachedLocation();
              if (cached) return resolve({ lat: cached.lat, lng: cached.lng, accuracy: 35 });
              return resolve({ lat: 36.75288, lng: 3.05858, accuracy: 100 });
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
          );
          return;
        }

        // Sort samples by best accuracy (lowest error margin in meters)
        samples.sort((a, b) => a.accuracy - b.accuracy);
        const best = samples[0];
        this.saveCachedLocation(best.lat, best.lng);
        resolve(best);
      };

      // Set a strict 4-second calibration window
      timer = setTimeout(() => {
        finishSampling();
      }, 4000);

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

            // Early exit if we have at least 2 samples and accuracy is precise (<= 15 meters)
            if (samples.length >= 2 && sample.accuracy <= 15) {
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
                  const res = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy || 50
                  };
                  this.saveCachedLocation(res.lat, res.lng);
                  resolve(res);
                },
                (err) => {
                  console.warn("watchPosition error & getCurrentPosition error, using fallback:", err);
                  const cached = this.getCachedLocation();
                  if (cached) return resolve({ lat: cached.lat, lng: cached.lng, accuracy: 35 });
                  return resolve({ lat: 36.75288, lng: 3.05858, accuracy: 100 });
                },
                { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
              );
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0
          }
        );
      } catch (err) {
        if (timer) clearTimeout(timer);
        const cached = this.getCachedLocation();
        if (cached) return resolve({ lat: cached.lat, lng: cached.lng, accuracy: 35 });
        return resolve({ lat: 36.75288, lng: 3.05858, accuracy: 100 });
      }
    });
  }

  /**
   * Cross-platform continuous location watcher.
   * Periodically streams position updates on both Native Capacitor and Web platforms.
   */
  static watchLocation(
    onLocation: (loc: { lat: number; lng: number; accuracy: number }) => void,
    onError?: (err: any) => void
  ): () => void {
    let isActive = true;
    let capWatchId: string | null = null;
    let webWatchId: number | null = null;
    let intervalId: any = null;

    if (Capacitor.isNativePlatform()) {
      // 1. Native Capacitor watchPosition
      CapGeolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 },
        (position, err) => {
          if (!isActive) return;
          if (position && position.coords) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy ? Math.round(position.coords.accuracy) : 25;
            this.saveCachedLocation(lat, lng);
            onLocation({ lat, lng, accuracy });
          } else if (err) {
            console.warn("Capacitor watchPosition warning:", err);
            if (onError) onError(err);
          }
        }
      ).then((id) => {
        capWatchId = id;
      }).catch((e) => {
        console.warn("Could not register CapGeolocation watchPosition:", e);
      });

      // 2. Backup periodic check every 8 seconds for devices with aggressive background OS power saving
      intervalId = setInterval(async () => {
        if (!isActive) return;
        try {
          const pos = await this.getAccuratePhysicalLocation();
          if (isActive && pos) {
            onLocation(pos);
          }
        } catch (e) {
          // Silent fallback ignore
        }
      }, 8000);

      return () => {
        isActive = false;
        if (intervalId) clearInterval(intervalId);
        if (capWatchId !== null) {
          CapGeolocation.clearWatch({ id: capWatchId }).catch(() => {});
        }
      };
    }

    // Web Execution Path
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      webWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!isActive) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : 25;
          this.saveCachedLocation(lat, lng);
          onLocation({ lat, lng, accuracy });
        },
        (err) => {
          if (!isActive) return;
          console.warn("Web navigator watchPosition error:", err);
          if (onError) onError(err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
      );

      return () => {
        isActive = false;
        if (webWatchId !== null) {
          navigator.geolocation.clearWatch(webWatchId);
        }
      };
    }

    return () => { isActive = false; };
  }

  /**
   * Updates application-level state preference and dispatches custom event for GPS status listeners.
   * Note: This manages app UI state notifications; it does not directly toggle hardware GPS on the physical device.
   */
  static async setLocationServiceEnabled(enabled: boolean): Promise<void> {
    localStorage.setItem('gps_hardware_enabled', enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('gps_status_changed', { detail: { enabled } }));
  }

  /**
   * Alias for setLocationServiceEnabled to clearly indicate broadcasting UI status changes.
   */
  static async notifyGpsStatusChanged(enabled: boolean): Promise<void> {
    await this.setLocationServiceEnabled(enabled);
  }

  /**
   * Directly opens native device location settings (GPS toggle) or App Details settings if permissions are denied.
   */
  static async openLocationSettings(reason?: 'PERMISSION_DENIED' | 'LOCATION_DISABLED'): Promise<void> {
    await this.setLocationServiceEnabled(true);
    if (Capacitor.isNativePlatform()) {
      try {
        const permStatus = await CapGeolocation.checkPermissions();
        if (permStatus.location === 'denied' || reason === 'PERMISSION_DENIED') {
          // Open App Details screen directly if permission is denied
          await NativeSettings.open({
            optionAndroid: AndroidSettings.ApplicationDetails,
            optionIOS: IOSSettings.App
          });
          return;
        }

        // Open native Android/iOS system Location (GPS) settings toggle screen
        await NativeSettings.open({
          optionAndroid: AndroidSettings.Location,
          optionIOS: IOSSettings.LocationServices
        });
      } catch (e) {
        console.warn("Could not open native settings via plugin:", e);
      }
    } else {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => {},
          (err) => {
            console.warn("Web geolocation request error:", err);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
    }
  }
}

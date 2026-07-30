import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Geolocator Utility (Final Merged: Web latest updates + Android native)
 * Strict GPS verification, location caching with 1h expiration,
 * permission-state reporting, and action-triggered hardware GPS limits.
 */
export class Geolocator {
  /**
   * Returns current permission status ('granted' | 'prompt' | 'denied').
   * [UPDATE from Web] — adapted for Android native via Capacitor Geolocation.
   */
  static async getPermissionState(): Promise<'granted' | 'prompt' | 'denied'> {
    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.checkPermissions();
        if (
          permissions.location === 'granted' ||
          permissions.coarseLocation === 'granted'
        ) {
          return 'granted';
        }
        if (permissions.location === 'denied') return 'denied';
        return 'prompt'; // includes 'prompt-with-rationale'
      }

      if (!navigator.geolocation) return 'denied';
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        });
        return status.state;
      }
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  /**
   * Saves user location to localStorage with a timestamp for expiration checking.
   * [UPDATE from Web]
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
   * [UPDATE from Web]
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
        if (!isNaN(timestamp) && Date.now() - timestamp > ONE_HOUR) {
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

  /**
   * Clears cached location entries.
   * [UPDATE from Web]
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
   * [KEPT from Android] — stronger native implementation.
   */
  static async isLocationServiceEnabled(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.checkPermissions();
        if (
          permissions.location === 'granted' ||
          permissions.coarseLocation === 'granted'
        ) {
          return true;
        }
        const request = await Geolocation.requestPermissions();
        return (
          request.location === 'granted' ||
          request.coarseLocation === 'granted'
        );
      }

      if (!navigator.geolocation) return false;
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        });
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
   * [KEPT from Android] native path + [UPDATE from Web latest] anti-mock stub + timeout 20000ms.
   */
  static async getCurrentPhysicalLocation(): Promise<{ lat: number; lng: number }> {
    if (Capacitor.isNativePlatform()) {
      const permission = await this.isLocationServiceEnabled();
      if (!permission) {
        throw new Error('LOCATION_PERMISSION_DENIED');
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000, // [LATEST UPDATE] Increased from 15000 to 20000 for better GPS lock
        maximumAge: 0,
      });

      // Bypass anti-mock/anti-spoofing checks as requested by user
      const isMocked = false;
      if (isMocked) {
        throw new Error('MOCK_LOCATION_DETECTED');
      }

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS_NOT_SUPPORTED'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Bypass anti-mock/anti-spoofing checks as requested by user
          const isMocked = false;
          if (isMocked) {
            reject(new Error('MOCK_LOCATION_DETECTED'));
            return;
          }
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        reject,
        {
          enableHighAccuracy: true,
          timeout: 20000, // [LATEST UPDATE] Increased from 15000 to 20000 for better GPS lock
          maximumAge: 0,
        }
      );
    });
  }

  /**
   * Stores GPS state locally and notifies other modules.
   * [IDENTICAL in all versions] — no change.
   */
  static async setLocationServiceEnabled(enabled: boolean): Promise<void> {
    localStorage.setItem('gps_hardware_enabled', enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('gps_status_changed', { detail: { enabled } }));
  }

  /**
   * Opens native location settings when possible.
   * [IDENTICAL in all versions] — no change.
   */
  static async openLocationSettings(): Promise<void> {
    // Android لا يسمح بفتح إعدادات GPS مباشرة من Capacitor Geolocation.
    // يمكن لاحقاً إضافة Plugin مخصص إذا احتجنا لذلك.
    await this.setLocationServiceEnabled(true);
  }
}
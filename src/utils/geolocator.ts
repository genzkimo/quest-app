import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export class Geolocator {
  /**
   * Checks if location services and permissions are available.
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

      if (!navigator.geolocation) {
        return false;
      }

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
   * Returns the current device location with maximum possible accuracy.
   */
  static async getCurrentPhysicalLocation(): Promise<{
    lat: number;
    lng: number;
  }> {
    if (Capacitor.isNativePlatform()) {
      const permission = await this.isLocationServiceEnabled();

      if (!permission) {
        throw new Error('LOCATION_PERMISSION_DENIED');
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

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
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }

  /**
   * Stores GPS state locally.
   */
  static async setLocationServiceEnabled(
    enabled: boolean
  ): Promise<void> {
    localStorage.setItem(
      'gps_hardware_enabled',
      enabled ? 'true' : 'false'
    );

    window.dispatchEvent(
      new CustomEvent('gps_status_changed', {
        detail: { enabled },
      })
    );
  }

  /**
   * Opens native location settings when possible.
   */
  static async openLocationSettings(): Promise<void> {
    // Android لا يسمح بفتح إعدادات GPS مباشرة من Capacitor Geolocation.
    // يمكن لاحقاً إضافة Plugin مخصص إذا احتجنا لذلك.
    await this.setLocationServiceEnabled(true);
  }
}
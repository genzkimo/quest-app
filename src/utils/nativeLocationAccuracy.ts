import { registerPlugin } from '@capacitor/core';

export interface LocationAccuracyPlugin {
  /**
   * Requests Google Play Services Location Settings dialog ("Turn on location? [OK] [No thanks]") on Android native.
   * On Web/iOS or if Google Play Services is unavailable, resolves with success: false.
   */
  requestHighAccuracy(): Promise<{ success: boolean; message?: string }>;
}

const LocationAccuracy = registerPlugin<LocationAccuracyPlugin>('LocationAccuracy', {
  web: {
    requestHighAccuracy: async () => {
      console.log('LocationAccuracy web fallback: Google Play Services prompt is only available on native Android.');
      return { success: false, message: 'Web fallback' };
    },
  },
});

export default LocationAccuracy;

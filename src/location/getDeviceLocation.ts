import * as Location from 'expo-location';

import type { CourierLocation } from '../api/types';

export type DeviceLocationResult = { ok: true; location: CourierLocation } | { ok: false; reason: string };

/**
 * One foreground position fix. Asks for permission first; a refusal or any platform error is
 * returned as a reason so the screen can fall back to the manual form.
 */
export async function getDeviceLocation(): Promise<DeviceLocationResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return { ok: false, reason: 'Location permission was not granted. Enter the coordinates by hand.' };
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { ok: true, location: { lat: position.coords.latitude, lng: position.coords.longitude } };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `Could not read the device location (${detail}). Enter the coordinates by hand.` };
  }
}

/** Parsing and validation of coordinates typed into the manual location form. */

import type { CourierLocation } from '../api/types';

export type CoordinateKind = 'lat' | 'lng';

const LIMITS: Record<CoordinateKind, number> = { lat: 90, lng: 180 };

/** Parse one coordinate, returning null for anything that is not a finite number in range. */
export function parseCoordinate(text: string, kind: CoordinateKind): number | null {
  const trimmed = text.trim();
  if (trimmed === '' || !/^[-+]?\d*\.?\d+$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || Math.abs(value) > LIMITS[kind]) {
    return null;
  }
  return value;
}

export type ParsedLocation = { ok: true; location: CourierLocation } | { ok: false; message: string };

export function parseLocation(latText: string, lngText: string): ParsedLocation {
  const lat = parseCoordinate(latText, 'lat');
  const lng = parseCoordinate(lngText, 'lng');
  if (lat === null) {
    return { ok: false, message: 'Latitude must be a number between -90 and 90.' };
  }
  if (lng === null) {
    return { ok: false, message: 'Longitude must be a number between -180 and 180.' };
  }
  return { ok: true, location: { lat, lng } };
}

/** Fixed decimals for display and for round-tripping device readings into the text fields. */
export function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

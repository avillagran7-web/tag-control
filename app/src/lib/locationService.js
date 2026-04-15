/**
 * Background Location Service — THE reason we went native.
 *
 * Uses expo-location + expo-task-manager for real background GPS tracking.
 * This works even when the app is in the background or the phone is locked.
 * No more audio keep-alive hacks, no more iOS Safari suspension.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { haversine, msToKmh, pointToSegmentDistance } from './geoUtils';
import tollsData from '../data/tolls.json';

const BACKGROUND_LOCATION_TASK = 'TAGCONTROL_BACKGROUND_LOCATION';
const DETECTION_RADIUS_M = 150;
const MIN_SPEED_KMH = 15;
const COOLDOWN_MS = 120000;
// Max gap between consecutive GPS samples to treat them as a continuous segment.
// Longer gaps (signal loss, app suspended) shouldn't draw a phantom straight line.
const MAX_SEGMENT_M = 500;

// In-memory state for background task
let _onTollCrossed = null;
let _onPositionUpdate = null;
let _cooldowns = {};
let _lastPosition = null;
let _isTracking = false;

function processLocation(location) {
  const { latitude, longitude, speed: rawSpeed, accuracy } = location.coords;
  const timestamp = location.timestamp || Date.now();

  if (accuracy > 1000) return;

  let speedKmh = 0;
  if (rawSpeed != null && rawSpeed >= 0) {
    speedKmh = msToKmh(rawSpeed);
  } else if (_lastPosition) {
    const dist = haversine(_lastPosition.lat, _lastPosition.lng, latitude, longitude);
    const timeSec = (timestamp - _lastPosition.timestamp) / 1000;
    if (timeSec > 0) speedKmh = (dist / timeSec) * 3.6;
  }
  if (speedKmh > 200) speedKmh = _lastPosition?.speed || 0;

  const prev = _lastPosition;
  _lastPosition = { lat: latitude, lng: longitude, timestamp, speed: speedKmh };

  _onPositionUpdate?.({ lat: latitude, lng: longitude, speed: speedKmh, accuracy, timestamp });

  // Segment-based proximity: at highway speed a single GPS point can fly past
  // the radius without ever landing inside, so we measure the distance from
  // each toll to the line segment between the previous and current sample.
  const useSegment =
    prev != null &&
    haversine(prev.lat, prev.lng, latitude, longitude) <= MAX_SEGMENT_M;

  const now = Date.now();
  for (const toll of tollsData.tolls) {
    const lastCrossed = _cooldowns[toll.id] || 0;
    if (now - lastCrossed < COOLDOWN_MS) continue;

    const radius = toll.radio_deteccion_m || DETECTION_RADIUS_M;
    const distance = useSegment
      ? pointToSegmentDistance(toll.lat, toll.lng, prev.lat, prev.lng, latitude, longitude)
      : haversine(latitude, longitude, toll.lat, toll.lng);

    const speedOk =
      speedKmh >= MIN_SPEED_KMH ||
      (speedKmh === 0 && distance <= radius);

    if (distance <= radius && speedOk) {
      _cooldowns[toll.id] = now;
      _onTollCrossed?.({
        toll,
        timestamp: now,
        lat: latitude,
        lng: longitude,
        speed: speedKmh,
        distance: Math.round(distance),
      });
    }
  }
}

/**
 * Register the background task. Must be called at module level (top of app).
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }) => {
  if (error) return;
  if (!data?.locations?.length) return;
  for (const location of data.locations) processLocation(location);
});

/**
 * Request location permissions (foreground + background).
 * Returns true if background location is granted.
 */
export async function requestLocationPermissions() {
  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') return false;

  const { status: background } = await Location.requestBackgroundPermissionsAsync();
  return background === 'granted';
}

/**
 * Start tracking GPS in background.
 * onTollCrossed: callback when a toll is detected
 * onPositionUpdate: callback for each GPS position (for UI/Supabase)
 */
export async function startTracking({ onTollCrossed, onPositionUpdate }) {
  _onTollCrossed = onTollCrossed;
  _onPositionUpdate = onPositionUpdate;
  _cooldowns = {};
  _lastPosition = null;
  _isTracking = true;

  // Start foreground location for immediate updates
  await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 20, // Update every 20 meters
      timeInterval: 3000, // Or every 3 seconds
    },
    processLocation
  );

  // Start background location (runs even when app is backgrounded/locked)
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 50,
    timeInterval: 5000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'TAGcontrol',
      notificationBody: 'Detectando peajes en tu viaje...',
      notificationColor: '#0F6E56',
    },
    deferredUpdatesInterval: 5000,
    deferredUpdatesDistance: 50,
  });
}

/**
 * Stop tracking.
 */
export async function stopTracking() {
  _isTracking = false;
  _onTollCrossed = null;
  _onPositionUpdate = null;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}

export function isTracking() {
  return _isTracking;
}

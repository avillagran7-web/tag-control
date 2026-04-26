/**
 * Background Location Service — THE reason we went native.
 *
 * Uses expo-location + expo-task-manager for real background GPS tracking.
 * This works even when the app is in the background or the phone is locked.
 * No more audio keep-alive hacks, no more iOS Safari suspension.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { haversine, msToKmh, pointToSegmentDistance } from './geoUtils';
import { getTarifa } from './pricing';
import { formatCLP } from './format';
import tollsData from '../data/tolls.json';

// Show notifications immediately while app is in foreground too
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const BACKGROUND_LOCATION_TASK = 'TAGCONTROL_BACKGROUND_LOCATION';
const DETECTION_RADIUS_M = 150;
const MIN_SPEED_KMH = 15;
const COOLDOWN_MS = 120000;
// 1200m bridges a ~48s GPS gap at 90 km/h — covers most tunnel blackouts.
const MAX_SEGMENT_M = 1200;
// 5 minutes: Santiago toll queues can hold a car stationary for 1–4 minutes
// before the actual crossing, so 3 min was sometimes too short.
const MOVING_BUFFER_MS = 5 * 60 * 1000;

// Toll pairs <250m apart share a single cooldown so only one crossing fires.
const TOLL_GROUPS = [
  ['vs-florida', 'vs-cisterna'],   // 22m — same Vespucio Sur portal, both directions
  ['vn-ruta5',   'vn-ce'],         // 52m — same Vespucio Norte portal
  ['vn-salto',   'vn-recoleta'],   // 189m — adjacent Vespucio Norte gantries
];
const TOLL_GROUP_KEY = {};
for (const group of TOLL_GROUPS) {
  for (const id of group) TOLL_GROUP_KEY[id] = group[0];
}

// In-memory state for background task
let _onTollCrossed = null;
let _onPositionUpdate = null;
let _cooldowns = {};
let _lastPosition = null;
let _lastMovingAt = 0; // timestamp of last sample at >= MIN_SPEED_KMH
let _isTracking = false;
let _watchSubscription = null;

function processLocation(location) {
  const { latitude, longitude, speed: rawSpeed, accuracy } = location.coords;
  const timestamp = location.timestamp || Date.now();

  // iOS delivers stale cached coordinates after tunnel exit. Discard them
  // so a ghost position doesn't falsely trigger a crossing.
  if (Date.now() - timestamp > 15000) return;

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

  const now = Date.now();

  // Update moving buffer before storing position.
  if (speedKmh >= MIN_SPEED_KMH) _lastMovingAt = now;
  const wasRecentlyMoving = (now - _lastMovingAt) < MOVING_BUFFER_MS;

  const prev = _lastPosition;
  _lastPosition = { lat: latitude, lng: longitude, timestamp, speed: speedKmh };

  _onPositionUpdate?.({ lat: latitude, lng: longitude, speed: speedKmh, accuracy, timestamp });

  const useSegment =
    prev != null &&
    haversine(prev.lat, prev.lng, latitude, longitude) <= MAX_SEGMENT_M;

  for (const toll of tollsData.tolls) {
    const groupKey = TOLL_GROUP_KEY[toll.id] || toll.id;
    const lastCrossed = _cooldowns[groupKey] || 0;
    if (now - lastCrossed < COOLDOWN_MS) continue;

    const radius = toll.radio_deteccion_m || DETECTION_RADIUS_M;
    const distance = useSegment
      ? pointToSegmentDistance(toll.lat, toll.lng, prev.lat, prev.lng, latitude, longitude)
      : haversine(latitude, longitude, toll.lat, toll.lng);

    // wasRecentlyMoving handles urban tolls in traffic (Costanera Norte,
    // Vespucio, Autopista Central): vehicle was at highway speed recently
    // and slowed to crawl at the toll gate. Zero-speed fallback covers
    // background mode where expo-location sometimes reports speed=0.
    const speedOk = wasRecentlyMoving || (speedKmh === 0 && distance <= radius);

    if (distance <= radius && speedOk) {
      _cooldowns[groupKey] = now;
      const crossing = {
        toll,
        timestamp: now,
        lat: latitude,
        lng: longitude,
        speed: speedKmh,
        distance: Math.round(distance),
      };
      _onTollCrossed?.(crossing);

      // Local notification — works in background and foreground
      Notifications.scheduleNotificationAsync({
        content: {
          title: '¡Peaje detectado!',
          body: `${toll.nombre}  ·  ${formatCLP(getTarifa(toll, new Date(now)))}`,
          sound: true,
        },
        trigger: null, // fire immediately
      }).catch(() => {});
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
 * Returns 'background' | 'foreground' | false.
 * 'foreground' = tracking works but only while app is visible.
 * false = user denied location entirely.
 */
export async function requestLocationPermissions() {
  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') return false;

  await Notifications.requestPermissionsAsync();

  const { status: background } = await Location.requestBackgroundPermissionsAsync();
  return background === 'granted' ? 'background' : 'foreground';
}

/**
 * Start tracking GPS.
 * background=true: tracks even when app is closed (requires Always permission).
 * background=false: tracks only while app is visible (When In Use permission).
 */
export async function startTracking({ onTollCrossed, onPositionUpdate, background = true }) {
  _onTollCrossed = onTollCrossed;
  _onPositionUpdate = onPositionUpdate;
  _cooldowns = {};
  _lastPosition = null;
  _lastMovingAt = 0;
  _isTracking = true;

  _watchSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 20,
      timeInterval: 3000,
    },
    processLocation
  );

  if (background) {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 50,
      timeInterval: 5000,
      showsBackgroundLocationIndicator: true,
      // Prevent iOS from pausing GPS when the device appears stationary —
      // toll queues look stationary to the OS but we still need position updates.
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'TAGcontrol',
        notificationBody: 'Detectando peajes en tu viaje...',
        notificationColor: '#0F6E56',
      },
      deferredUpdatesInterval: 5000,
      deferredUpdatesDistance: 50,
    });
  }
}

/**
 * Stop tracking.
 */
export async function stopTracking() {
  _isTracking = false;
  _onTollCrossed = null;
  _onPositionUpdate = null;

  // Remove foreground watch subscription — prevents ghost callbacks post-trip
  _watchSubscription?.remove();
  _watchSubscription = null;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}

export function isTracking() {
  return _isTracking;
}

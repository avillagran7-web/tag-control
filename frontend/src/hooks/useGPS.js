import { useState, useEffect, useRef, useCallback } from 'react';
import { haversine, msToKmh } from '../lib/geoUtils';
import tollsData from '../data/tolls.json';

const DETECTION_RADIUS_M = 150;
const MIN_SPEED_KMH = 20;
const COOLDOWN_MS = 120000; // 2 minutos

export function useGPS({ onTollCrossed } = {}) {
  const [position, setPosition] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionState, setPermissionState] = useState('prompt');

  const watchIdRef = useRef(null);
  const cooldownsRef = useRef({}); // { tollId: lastCrossedTimestamp }
  const onTollCrossedRef = useRef(onTollCrossed);

  useEffect(() => {
    onTollCrossedRef.current = onTollCrossed;
  }, [onTollCrossed]);

  // Verificar estado del permiso de ubicación
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionState(result.state);
        result.addEventListener('change', () => setPermissionState(result.state));
      });
    }
  }, []);

  const checkTollProximity = useCallback((lat, lng, currentSpeed) => {
    const now = Date.now();

    for (const toll of tollsData.tolls) {
      const distance = haversine(lat, lng, toll.lat, toll.lng);
      const lastCrossed = cooldownsRef.current[toll.id] || 0;
      const isInCooldown = now - lastCrossed < COOLDOWN_MS;

      if (
        distance <= (toll.radio_deteccion_m || DETECTION_RADIUS_M) &&
        currentSpeed >= MIN_SPEED_KMH &&
        !isInCooldown
      ) {
        cooldownsRef.current[toll.id] = now;

        const crossing = {
          toll,
          timestamp: now,
          lat,
          lng,
          speed: currentSpeed,
          distance: Math.round(distance),
        };

        onTollCrossedRef.current?.(crossing);
      }
    }
  }, []);

  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Tu navegador no soporta GPS.');
      return;
    }

    setError(null);
    setIsTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed: rawSpeed } = pos.coords;
        const speedKmh = rawSpeed != null ? msToKmh(rawSpeed) : 0;

        setPosition({ lat: latitude, lng: longitude });
        setSpeed(speedKmh);
        setError(null);

        checkTollProximity(latitude, longitude, speedKmh);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Permiso de ubicación denegado. Actívalo en Ajustes > Safari > Ubicación.');
            setPermissionState('denied');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('No se pudo obtener tu ubicación. Verifica que el GPS esté activo.');
            break;
          case err.TIMEOUT:
            setError('La solicitud de ubicación tardó demasiado.');
            break;
          default:
            setError('Error desconocido al obtener ubicación.');
        }
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );
  }, [checkTollProximity]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    position,
    speed,
    error,
    isTracking,
    permissionState,
    startTracking,
    stopTracking,
  };
}

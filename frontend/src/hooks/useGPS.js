import { useState, useEffect, useRef, useCallback } from 'react';
import { haversine, msToKmh } from '../lib/geoUtils';
import tollsData from '../data/tolls.json';

const DETECTION_RADIUS_M = 150;
const MIN_SPEED_KMH = 20;
const COOLDOWN_MS = 120000;
const THROTTLE_MS = 3000; // Procesar GPS máximo cada 3 segundos

export function useGPS({ onTollCrossed } = {}) {
  const [position, setPosition] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  const watchIdRef = useRef(null);
  const cooldownsRef = useRef({});
  const onTollCrossedRef = useRef(onTollCrossed);
  const lastPositionRef = useRef(null);
  const lastProcessedRef = useRef(0); // Throttle timestamp

  useEffect(() => {
    onTollCrossedRef.current = onTollCrossed;
  }, [onTollCrossed]);

  const calculateSpeed = useCallback((lat, lng, timestamp) => {
    const last = lastPositionRef.current;
    if (!last) return 0;
    const distMeters = haversine(last.lat, last.lng, lat, lng);
    const timeSec = (timestamp - last.timestamp) / 1000;
    if (timeSec <= 0) return 0;
    const speedKmh = (distMeters / timeSec) * 3.6;
    if (speedKmh > 200) return last.speed || 0;
    return speedKmh;
  }, []);

  const checkTollProximity = useCallback((lat, lng, currentSpeed) => {
    const now = Date.now();
    for (const toll of tollsData.tolls) {
      const distance = haversine(lat, lng, toll.lat, toll.lng);
      const lastCrossed = cooldownsRef.current[toll.id] || 0;
      const isInCooldown = now - lastCrossed < COOLDOWN_MS;
      const radius = toll.radio_deteccion_m || DETECTION_RADIUS_M;
      if (distance <= radius && currentSpeed >= MIN_SPEED_KMH && !isInCooldown) {
        cooldownsRef.current[toll.id] = now;
        onTollCrossedRef.current?.({
          toll, timestamp: now, lat, lng, speed: currentSpeed, distance: Math.round(distance),
        });
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
    lastPositionRef.current = null;
    lastProcessedRef.current = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed: rawSpeed, accuracy } = pos.coords;
        const timestamp = pos.timestamp || Date.now();

        // Ignorar lecturas con precisión muy mala
        if (accuracy > 150) return;

        // Throttle: no procesar más de 1 vez cada 5 segundos
        const now = Date.now();
        if (now - lastProcessedRef.current < THROTTLE_MS) return;
        lastProcessedRef.current = now;

        // Velocidad
        let speedKmh;
        if (rawSpeed != null && rawSpeed >= 0) {
          speedKmh = msToKmh(rawSpeed);
        } else {
          speedKmh = calculateSpeed(latitude, longitude, timestamp);
        }

        lastPositionRef.current = { lat: latitude, lng: longitude, timestamp, speed: speedKmh };

        setPosition({ lat: latitude, lng: longitude });
        setSpeed(speedKmh);
        setError(null);

        checkTollProximity(latitude, longitude, speedKmh);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Permiso de ubicación denegado. Actívalo en Ajustes > Safari > Ubicación.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('No se pudo obtener tu ubicación. Verifica que el GPS esté activo.');
            break;
          case err.TIMEOUT:
            setError('Buscando señal GPS...');
            break;
          default:
            setError('Error al obtener ubicación.');
        }
      },
      {
        // GPS real necesario para detectar pórticos a 80+ km/h
        // Con WiFi/cell el GPS se congela y pierde peajes
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      }
    );
  }, [checkTollProximity, calculateSpeed]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    lastPositionRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  return { position, speed, error, isTracking, startTracking, stopTracking };
}

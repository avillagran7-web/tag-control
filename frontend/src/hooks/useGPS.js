import { useState, useEffect, useRef, useCallback } from 'react';
import { haversine, msToKmh, pointToSegmentDistance } from '../lib/geoUtils';
import tollsData from '../data/tolls.json';

const DETECTION_RADIUS_M = 150;
const MIN_SPEED_KMH = 20;
const COOLDOWN_MS = 120000;
const THROTTLE_MS = 3000; // Procesar GPS máximo cada 3 segundos
const MAX_ACCURACY_M = 300; // Aceptar lecturas hasta 300m (iOS post-background da ~200m)
const TOLL_CHECK_ACCURACY_M = 1000; // Para chequeo de peajes, aceptar incluso en túneles
const MAX_SEGMENT_M = 500; // Gap máximo entre samples para tratarlos como segmento continuo

export function useGPS({ onTollCrossed } = {}) {
  const [position, setPosition] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  const watchIdRef = useRef(null);
  const cooldownsRef = useRef({});
  const onTollCrossedRef = useRef(onTollCrossed);
  const lastPositionRef = useRef(null);
  const prevSampleRef = useRef(null); // Sample anterior sin throttle, para detección por segmento
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

  const checkTollProximity = useCallback((lat, lng, currentSpeed, accuracy) => {
    const now = Date.now();
    // Detección por segmento: a 80 km/h con sample cada 5s los puntos GPS están a
    // ~110m, y un check punto-a-punto puede saltar por encima del radio sin que
    // ningún sample caiga adentro. Medimos distancia del peaje al segmento entre
    // sample anterior y actual cuando ambos están razonablemente cerca.
    const prev = prevSampleRef.current;
    const useSegment =
      prev != null &&
      haversine(prev.lat, prev.lng, lat, lng) <= MAX_SEGMENT_M;
    for (const toll of tollsData.tolls) {
      const distance = useSegment
        ? pointToSegmentDistance(toll.lat, toll.lng, prev.lat, prev.lng, lat, lng)
        : haversine(lat, lng, toll.lat, toll.lng);
      const lastCrossed = cooldownsRef.current[toll.id] || 0;
      const isInCooldown = now - lastCrossed < COOLDOWN_MS;
      const baseRadius = toll.radio_deteccion_m || DETECTION_RADIUS_M;
      // Cuando accuracy es mala (post-background), expandir el radio proporcionalmente
      // pero limitar a 2x el radio base para no dar falsos positivos
      const accuracyBonus = accuracy > MAX_ACCURACY_M ? Math.min(accuracy * 0.3, baseRadius) : 0;
      const radius = baseRadius + accuracyBonus;

      // Velocidad: si GPS reporta rawSpeed, confiar en ella.
      // Si no hay speed (post-background, iOS), y estamos DENTRO del radio expandido,
      // asumir que están en movimiento (nadie se detiene dentro de un pórtico)
      const speedOk = currentSpeed >= MIN_SPEED_KMH || (currentSpeed === 0 && distance <= radius);

      if (distance <= radius && speedOk && !isInCooldown) {
        cooldownsRef.current[toll.id] = now;
        onTollCrossedRef.current?.({
          toll, timestamp: now, lat, lng, speed: currentSpeed, distance: Math.round(distance),
        });
      }
    }
  }, []);

  // Forzar una lectura GPS inmediata (para cuando iOS vuelve del background)
  const forceGPSRead = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, speed: rawSpeed, accuracy } = pos.coords;
        if (accuracy > TOLL_CHECK_ACCURACY_M) return;
        let speedKmh = 0;
        if (rawSpeed != null && rawSpeed >= 0) {
          speedKmh = msToKmh(rawSpeed);
        } else if (lastPositionRef.current) {
          const dist = haversine(lastPositionRef.current.lat, lastPositionRef.current.lng, latitude, longitude);
          const timeSec = (Date.now() - lastPositionRef.current.timestamp) / 1000;
          if (timeSec > 0) speedKmh = (dist / timeSec) * 3.6;
        }
        checkTollProximity(latitude, longitude, speedKmh, accuracy);
        prevSampleRef.current = { lat: latitude, lng: longitude };
        lastPositionRef.current = { lat: latitude, lng: longitude, timestamp: Date.now(), speed: speedKmh };
        setPosition({ lat: latitude, lng: longitude });
        setSpeed(speedKmh);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
  }, [checkTollProximity]);

  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Tu navegador no soporta GPS.');
      return;
    }

    setError(null);
    setIsTracking(true);
    lastPositionRef.current = null;
    prevSampleRef.current = null;
    lastProcessedRef.current = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed: rawSpeed, accuracy } = pos.coords;
        const timestamp = pos.timestamp || Date.now();

        // Ignorar lecturas con precisión extremadamente mala (>500m = sin GPS real)
        if (accuracy > TOLL_CHECK_ACCURACY_M) return;

        // Siempre chequear peajes aunque la precisión no sea perfecta
        // iOS al volver del background da accuracy ~200m pero la posición es razonable
        // Usar el radio del peaje + accuracy como margen
        let speedKmh;
        if (rawSpeed != null && rawSpeed >= 0) {
          speedKmh = msToKmh(rawSpeed);
        } else {
          speedKmh = calculateSpeed(latitude, longitude, timestamp);
        }

        // Chequear peajes ANTES del throttle — no perder un cruce por timing
        checkTollProximity(latitude, longitude, speedKmh, accuracy);
        // prevSample se actualiza CADA sample (no throttled) para que la
        // detección por segmento siempre use el sample inmediatamente anterior
        prevSampleRef.current = { lat: latitude, lng: longitude };

        // Throttle para UI updates y posiciones (no para detección de peajes)
        const now = Date.now();
        if (now - lastProcessedRef.current < THROTTLE_MS) return;
        lastProcessedRef.current = now;

        lastPositionRef.current = { lat: latitude, lng: longitude, timestamp, speed: speedKmh };

        setPosition({ lat: latitude, lng: longitude });
        setSpeed(speedKmh);
        setError(null);
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
    prevSampleRef.current = null;
  }, []);

  // Cuando la app vuelve al foreground (iOS), forzar lectura GPS inmediata
  // watchPosition puede tardar segundos en reactivarse después de background
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && watchIdRef.current != null) {
        forceGPSRead();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [forceGPSRead]);

  return { position, speed, error, isTracking, startTracking, stopTracking, forceGPSRead };
}

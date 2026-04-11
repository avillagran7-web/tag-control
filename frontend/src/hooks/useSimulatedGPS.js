import { useState, useEffect, useRef, useCallback } from 'react';
import { haversine } from '../lib/geoUtils';
import tollsData from '../data/tolls.json';

const DETECTION_RADIUS_M = 150;
const COOLDOWN_MS = 5000; // 5s en simulación (en real sería 120s)

// Ruta simulada: Algarrobo → Santiago por Ruta 68
// Pasa por los 4 peajes en orden + puntos intermedios
const SIMULATED_ROUTE = [
  // Salida Algarrobo
  { lat: -33.3620, lng: -71.6740, speed: 0, label: 'Saliendo de Algarrobo...' },
  { lat: -33.3580, lng: -71.6200, speed: 40, label: 'Entrando a Ruta 68' },
  { lat: -33.3400, lng: -71.5500, speed: 100, label: 'Ruta 68 km 90' },
  { lat: -33.3250, lng: -71.4800, speed: 110, label: 'Acercándose a Casablanca' },
  // Peaje El Abrazo
  { lat: -33.3160, lng: -71.4190, speed: 80, label: '→ Peaje El Abrazo' },
  { lat: -33.3156, lng: -71.4187, speed: 60, label: '🚧 Cruzando El Abrazo!' },
  { lat: -33.3150, lng: -71.4100, speed: 100, label: 'Pasó El Abrazo ✓' },
  // Camino a Curacaví
  { lat: -33.3500, lng: -71.3000, speed: 110, label: 'Ruta 68 km 70' },
  { lat: -33.3700, lng: -71.2200, speed: 100, label: 'Acercándose a Curacaví' },
  // Peaje La Pólvora
  { lat: -33.3885, lng: -71.1430, speed: 80, label: '→ Peaje La Pólvora' },
  { lat: -33.3891, lng: -71.1423, speed: 60, label: '🚧 Cruzando La Pólvora!' },
  { lat: -33.3900, lng: -71.1400, speed: 100, label: 'Pasó La Pólvora ✓' },
  // Camino a Lo Prado
  { lat: -33.4100, lng: -71.0500, speed: 110, label: 'Ruta 68 km 40' },
  { lat: -33.4300, lng: -70.9800, speed: 100, label: 'Acercándose a túnel Lo Prado' },
  // Peaje Lo Prado
  { lat: -33.4608, lng: -70.8740, speed: 70, label: '→ Peaje Lo Prado' },
  { lat: -33.4612, lng: -70.8734, speed: 50, label: '🚧 Cruzando Lo Prado!' },
  { lat: -33.4615, lng: -70.8720, speed: 90, label: 'Pasó Lo Prado ✓' },
  // Camino a Pudahuel
  { lat: -33.4500, lng: -70.8300, speed: 100, label: 'Ruta 68 km 15' },
  // Peaje Pudahuel
  { lat: -33.4398, lng: -70.7895, speed: 70, label: '→ Peaje Pudahuel' },
  { lat: -33.4401, lng: -70.7891, speed: 50, label: '🚧 Cruzando Pudahuel!' },
  { lat: -33.4405, lng: -70.7880, speed: 80, label: 'Pasó Pudahuel ✓' },
  // Llegada Santiago
  { lat: -33.4420, lng: -70.7500, speed: 60, label: 'Entrando a Santiago' },
  { lat: -33.4450, lng: -70.7000, speed: 30, label: 'Llegaste a Santiago 🏁' },
  { lat: -33.4450, lng: -70.7000, speed: 0, label: 'Viaje completado' },
];

export function useSimulatedGPS({ onTollCrossed } = {}) {
  const [position, setPosition] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [label, setLabel] = useState('');
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to SIMULATED_ROUTE.length - 1

  const intervalRef = useRef(null);
  const cooldownsRef = useRef({});
  const onTollCrossedRef = useRef(onTollCrossed);
  const stepRef = useRef(0);

  useEffect(() => {
    onTollCrossedRef.current = onTollCrossed;
  }, [onTollCrossed]);

  const checkTollProximity = useCallback((lat, lng, currentSpeed) => {
    const now = Date.now();

    for (const toll of tollsData.tolls) {
      const distance = haversine(lat, lng, toll.lat, toll.lng);
      const lastCrossed = cooldownsRef.current[toll.id] || 0;
      const isInCooldown = now - lastCrossed < COOLDOWN_MS;

      if (distance <= (toll.radio_deteccion_m || DETECTION_RADIUS_M) && currentSpeed >= 20 && !isInCooldown) {
        cooldownsRef.current[toll.id] = now;
        onTollCrossedRef.current?.({
          toll,
          timestamp: now,
          lat,
          lng,
          speed: currentSpeed,
          distance: Math.round(distance),
        });
      }
    }
  }, []);

  const startTracking = useCallback(() => {
    setIsTracking(true);
    setError(null);
    stepRef.current = 0;
    cooldownsRef.current = {};

    intervalRef.current = setInterval(() => {
      const step = stepRef.current;

      if (step >= SIMULATED_ROUTE.length) {
        clearInterval(intervalRef.current);
        setIsTracking(false);
        return;
      }

      const point = SIMULATED_ROUTE[step];
      setPosition({ lat: point.lat, lng: point.lng });
      setSpeed(point.speed);
      setLabel(point.label);
      setProgress(step);

      checkTollProximity(point.lat, point.lng, point.speed);

      stepRef.current = step + 1;
    }, 1500); // Avanza cada 1.5 segundos
  }, [checkTollProximity]);

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    position,
    speed,
    error,
    isTracking,
    permissionState: 'granted',
    startTracking,
    stopTracking,
    // Extra para simulación
    label,
    progress,
    totalSteps: SIMULATED_ROUTE.length,
    isSimulation: true,
  };
}

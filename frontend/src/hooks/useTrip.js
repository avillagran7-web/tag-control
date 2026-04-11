import { useState, useCallback, useRef, useEffect } from 'react';
import { getTarifa } from '../lib/pricing';
import { saveTrip } from '../lib/storage';

export function useTrip() {
  const [isActive, setIsActive] = useState(false);
  const [crossings, setCrossings] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [driver, setDriver] = useState(null);
  const crossingsRef = useRef([]);

  useEffect(() => {
    crossingsRef.current = crossings;
  }, [crossings]);

  const startTrip = useCallback((driverName) => {
    setIsActive(true);
    setCrossings([]);
    setStartTime(Date.now());
    setDriver(driverName || null);
  }, []);

  const endTrip = useCallback(() => {
    const prev = crossingsRef.current;
    if (prev.length > 0) {
      const totalCost = prev.reduce((sum, c) => sum + getTarifa(c.toll, new Date(c.timestamp)), 0);
      const routes = [...new Set(prev.map((c) => c.toll.ruta))];
      saveTrip({
        id: Date.now().toString(),
        driver: driver || 'Sin nombre',
        startTime: startTime || prev[0].timestamp,
        endTime: Date.now(),
        crossings: prev.map((c) => ({
          tollId: c.toll.id,
          tollNombre: c.toll.nombre,
          tollRuta: c.toll.ruta,
          tarifa: getTarifa(c.toll, new Date(c.timestamp)),
          timestamp: c.timestamp,
        })),
        totalCost,
        tollCount: prev.length,
        routes,
      });
    }
    setIsActive(false);
    setCrossings([]);
    setStartTime(null);
    setDriver(null);
  }, [startTime, driver]);

  const addCrossing = useCallback((crossing) => {
    setCrossings((prev) => [...prev, crossing]);
  }, []);

  const totalCost = crossings.reduce((sum, c) => sum + getTarifa(c.toll, new Date(c.timestamp)), 0);
  const tollCount = crossings.length;

  return {
    isActive,
    crossings,
    startTime,
    driver,
    totalCost,
    tollCount,
    startTrip,
    endTrip,
    addCrossing,
  };
}

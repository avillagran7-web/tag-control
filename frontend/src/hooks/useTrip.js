import { useState, useCallback, useRef, useEffect } from 'react';
import { getTarifa } from '../lib/pricing';
import { saveTrip } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { inferPostTrip } from '../lib/inference';

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
      // Inferencia post-viaje: rellenar peajes faltantes entre los detectados
      const inferred = inferPostTrip(prev);
      const allCrossings = [...prev, ...inferred].sort((a, b) => a.timestamp - b.timestamp);

      const totalCost = allCrossings.reduce((sum, c) => sum + getTarifa(c.toll, new Date(c.timestamp)), 0);
      const routes = [...new Set(allCrossings.map((c) => c.toll.ruta))];
      const tripData = {
        id: Date.now().toString(),
        driver: driver || 'Sin nombre',
        startTime: startTime || allCrossings[0].timestamp,
        endTime: Date.now(),
        crossings: allCrossings.map((c) => ({
          tollId: c.toll.id,
          tollNombre: c.toll.nombre,
          tollRuta: c.toll.ruta,
          tarifa: getTarifa(c.toll, new Date(c.timestamp)),
          timestamp: c.timestamp,
          inferred: c.inferred || false,
        })),
        totalCost,
        tollCount: allCrossings.length,
        routes,
      };

      // Guardar local
      saveTrip(tripData);

      // Guardar en Supabase
      supabase.from('trips').insert({
        id: tripData.id,
        driver: tripData.driver,
        start_time: new Date(tripData.startTime).toISOString(),
        end_time: new Date(tripData.endTime).toISOString(),
        total_cost: tripData.totalCost,
        toll_count: tripData.tollCount,
        routes: tripData.routes,
        crossings: tripData.crossings,
      }).then(({ error }) => {
        if (error) console.warn('Supabase save error:', error.message);
      });
    }
    setIsActive(false);
    setCrossings([]);
    setStartTime(null);
    setDriver(null);
  }, [startTime, driver]);

  const resumeTrip = useCallback(() => {
    setIsActive(true);
  }, []);

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
    resumeTrip,
    endTrip,
    addCrossing,
  };
}

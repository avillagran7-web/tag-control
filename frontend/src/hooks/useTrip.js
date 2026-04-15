import { useState, useCallback, useRef, useEffect } from 'react';
import { getTarifa } from '../lib/pricing';
import { saveTrip } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { inferPostTrip } from '../lib/inference';
import { reconstructTrip, mergeCrossings } from '../lib/reconstruction';

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

  const endTrip = useCallback((liveTripId) => {
    const prev = crossingsRef.current;
    if (prev.length > 0) {
      // Inferencia post-viaje: rellenar peajes faltantes entre los detectados
      const inferred = inferPostTrip(prev);
      const allCrossings = [...prev, ...inferred].sort((a, b) => a.timestamp - b.timestamp);

      const totalCost = allCrossings.reduce((sum, c) => sum + getTarifa(c.toll, new Date(c.timestamp)), 0);
      const routes = [...new Set(allCrossings.map((c) => c.toll.ruta))];
      // Usar el liveTripId para vincular con posiciones GPS en Supabase
      const tripId = liveTripId || Date.now().toString();
      const tripData = {
        id: tripId,
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

      // Guardar en Supabase, luego reconstruir desde GPS positions
      supabase.from('trips').insert({
        id: tripData.id,
        driver: tripData.driver,
        start_time: new Date(tripData.startTime).toISOString(),
        end_time: new Date(tripData.endTime).toISOString(),
        total_cost: tripData.totalCost,
        toll_count: tripData.tollCount,
        routes: tripData.routes,
        crossings: tripData.crossings,
        platform: 'web',
      }).then(({ error }) => {
        if (error) {
          console.warn('Supabase save error:', error.message);
          return;
        }
        // Safety net: reconstruir desde posiciones GPS para encontrar peajes perdidos
        reconstructTrip(tripId, allCrossings).then((result) => {
          if (!result || result.newTolls === 0) return;
          // Actualizar trip con peajes reconstruidos
          const merged = mergeCrossings(allCrossings, result.crossings.filter(c => c.reconstructed));
          const newCost = merged.reduce((sum, c) => sum + getTarifa(c.toll, new Date(c.timestamp)), 0);
          const newRoutes = [...new Set(merged.map(c => c.toll.ruta))];
          supabase.from('trips').update({
            crossings: merged.map(c => ({
              tollId: c.toll.id,
              tollNombre: c.toll.nombre,
              tollRuta: c.toll.ruta,
              tarifa: getTarifa(c.toll, new Date(c.timestamp)),
              timestamp: c.timestamp,
              inferred: c.inferred || c.reconstructed || false,
            })),
            total_cost: newCost,
            toll_count: merged.length,
            routes: newRoutes,
          }).eq('id', tripId).then(() => {});
        }).catch(() => {});
      });
    } else if (liveTripId) {
      // No crossings en real-time. Intentar reconstruir desde GPS, pero
      // SIEMPRE grabar el trip (aunque reconstrucción también falle) para que
      // el Admin pueda verlo en "Viajes en riesgo" y accionar manualmente.
      reconstructTrip(liveTripId, []).then((result) => {
        const rec = result && result.tollCount > 0 ? result : null;
        const tripData = {
          id: liveTripId,
          driver: driver || 'Sin nombre',
          startTime: startTime || Date.now(),
          endTime: Date.now(),
          crossings: rec ? rec.crossings.map(c => ({
            tollId: c.toll.id,
            tollNombre: c.toll.nombre,
            tollRuta: c.toll.ruta,
            tarifa: getTarifa(c.toll, new Date(c.timestamp)),
            timestamp: c.timestamp,
            inferred: true,
          })) : [],
          totalCost: rec ? rec.totalCost : 0,
          tollCount: rec ? rec.tollCount : 0,
          routes: rec ? [...new Set(rec.crossings.map(c => c.toll.ruta))] : [],
        };
        if (rec) saveTrip(tripData);
        supabase.from('trips').insert({
          id: tripData.id,
          driver: tripData.driver,
          start_time: new Date(tripData.startTime).toISOString(),
          end_time: new Date(tripData.endTime).toISOString(),
          total_cost: tripData.totalCost,
          toll_count: tripData.tollCount,
          routes: tripData.routes,
          crossings: tripData.crossings,
          platform: 'web',
        }).then(() => {});
      }).catch(() => {});
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

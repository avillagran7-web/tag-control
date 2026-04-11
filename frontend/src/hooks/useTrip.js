import { useState, useCallback } from 'react';
import { getTarifa } from '../lib/pricing';

export function useTrip() {
  const [isActive, setIsActive] = useState(false);
  const [crossings, setCrossings] = useState([]);
  const [startTime, setStartTime] = useState(null);

  const startTrip = useCallback(() => {
    setIsActive(true);
    setCrossings([]);
    setStartTime(Date.now());
  }, []);

  const endTrip = useCallback(() => {
    setIsActive(false);
    setStartTime(null);
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
    totalCost,
    tollCount,
    startTrip,
    endTrip,
    addCrossing,
  };
}

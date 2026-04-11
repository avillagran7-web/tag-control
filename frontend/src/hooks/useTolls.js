import { useMemo } from 'react';
import tollsData from '../data/tolls.json';

export function useTolls() {
  const tolls = tollsData.tolls;

  const tollsByRoute = useMemo(() => {
    const grouped = {};
    for (const toll of tolls) {
      if (!grouped[toll.ruta]) grouped[toll.ruta] = [];
      grouped[toll.ruta].push(toll);
    }
    return grouped;
  }, [tolls]);

  const routes = useMemo(() => Object.keys(tollsByRoute), [tollsByRoute]);

  const getTollById = (id) => tolls.find((t) => t.id === id);

  return { tolls, tollsByRoute, routes, getTollById };
}

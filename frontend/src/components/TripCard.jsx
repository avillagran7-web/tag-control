function formatCLP(amount) {
  return amount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

export default function TripCard({ crossings, totalCost }) {
  if (crossings.length === 0) return null;

  const firstCrossing = crossings[0];
  const lastCrossing = crossings[crossings.length - 1];
  const routes = [...new Set(crossings.map((c) => c.toll.ruta))];

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-medium text-gray-900">Viaje en curso</p>
          <p className="text-xs text-gray-500">{routes.join(' → ')}</p>
        </div>
        <span className="text-lg font-bold text-primary">{formatCLP(totalCost)}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>
          {new Date(firstCrossing.timestamp).toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <span className="flex-1 border-t border-dashed border-gray-300" />
        <span>
          {new Date(lastCrossing.timestamp).toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}

function formatCLP(amount) {
  return amount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

export default function HeroCard({ totalCost, tollCount, isTracking }) {
  return (
    <div className="bg-primary rounded-2xl p-6 text-white shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm opacity-80">Gasto de hoy</span>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
            isTracking ? 'bg-white/20' : 'bg-white/10 opacity-60'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${isTracking ? 'bg-green-300 animate-pulse' : 'bg-gray-300'}`}
          />
          {isTracking ? 'GPS activo' : 'GPS inactivo'}
        </span>
      </div>
      <p className="text-4xl font-bold tracking-tight">{formatCLP(totalCost)}</p>
      <p className="text-sm opacity-80 mt-1">
        {tollCount === 0
          ? 'Sin peajes registrados'
          : `${tollCount} peaje${tollCount > 1 ? 's' : ''} cruzado${tollCount > 1 ? 's' : ''}`}
      </p>
    </div>
  );
}

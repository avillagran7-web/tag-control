import { getTarifa } from '../lib/pricing';

function formatCLP(amount) {
  return amount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TollChip({ crossing }) {
  const { toll, timestamp } = crossing;

  return (
    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <div>
          <p className="font-medium text-gray-900 text-sm">{toll.nombre}</p>
          <p className="text-xs text-gray-500">{toll.ruta} &middot; {formatTime(timestamp)}</p>
        </div>
      </div>
      <span className="font-semibold text-primary">{formatCLP(getTarifa(toll, new Date(timestamp)))}</span>
    </div>
  );
}

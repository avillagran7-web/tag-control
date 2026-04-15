import { formatCLP, formatDate, formatTime } from '../../lib/format';

export default function AdminData({ stats, allCrossings, allTrips, completedTrips = [], onReconstructTrip, reconstructing, reconstructResults }) {
  const atRisk = completedTrips.filter(t => (t.toll_count || 0) === 0);

  // Map last reconstruct result by tripId for inline feedback
  const resultByTrip = {};
  if (reconstructResults) {
    for (const r of reconstructResults) {
      if (r.tripId) resultByTrip[r.tripId] = r;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {atRisk.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-semibold text-yellow-300">⚠ Viajes en riesgo ({atRisk.length})</p>
            <span className="text-[10px] text-yellow-400/70">0 peajes detectados — posible falla</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {atRisk.slice(0, 10).map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-3 py-2">
                <div>
                  <span className="font-medium">{t.driver}</span>
                  <span className="text-gray-400 ml-2">{formatDate(t.start_time)} {formatTime(t.start_time)}</span>
                </div>
                {onReconstructTrip && (() => {
                  const res = resultByTrip[t.id];
                  if (res?.error) return (
                    <span className="text-[10px] text-red-400 px-2">Error</span>
                  );
                  if (res) return (
                    <span className="text-[10px] text-green-400 px-2">
                      {res.newTolls > 0 ? `+${res.newTolls} peajes` : 'Sin datos GPS'}
                    </span>
                  );
                  return (
                    <button
                      onClick={() => onReconstructTrip(t.id)}
                      disabled={reconstructing}
                      className="text-[10px] text-yellow-300 font-medium px-2 py-1 bg-yellow-500/20 rounded disabled:opacity-50"
                    >
                      {reconstructing ? '...' : 'Reconstruir'}
                    </button>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs text-gray-400 mb-2 font-medium">Usuarios registrados</p>
        <div className="flex flex-wrap gap-2">
          {stats?.driverList.map(d => (
            <span key={d} className="bg-white/5 px-3 py-1 rounded-full text-xs">{d}</span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2 font-medium">Últimos 20 cruces de peajes</p>
        <div className="bg-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th className="px-3 py-2 text-left">Peaje</th>
                <th className="px-3 py-2 text-left">Ruta</th>
                <th className="px-3 py-2 text-right">Tarifa</th>
                <th className="px-3 py-2 text-right">Hora</th>
              </tr>
            </thead>
            <tbody>
              {allCrossings.slice(0, 20).map(c => (
                <tr key={c.id} className="border-b border-white/10">
                  <td className="px-3 py-2">{c.toll_nombre}</td>
                  <td className="px-3 py-2 text-gray-400">{c.toll_ruta}</td>
                  <td className="px-3 py-2 text-right text-primary">{formatCLP(c.tarifa)}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{formatTime(c.crossed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2 font-medium">Base de datos</p>
        <div className="bg-white/5 rounded-xl p-3 text-xs text-gray-400">
          <p>live_trips: {allTrips.length} registros</p>
          <p>live_crossings: {allCrossings.length} registros</p>
          <p>Supabase: nttnryildsxllxqfkkvz</p>
        </div>
      </div>
    </div>
  );
}

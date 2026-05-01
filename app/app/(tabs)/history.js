import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useUser } from '../_layout';
import { supabase } from '../../src/lib/supabase';
import { DEMO_TRIPS } from '../../src/lib/demoData';
import { formatCLP, formatDate, formatTime } from '../../src/lib/format';

const PRIMARY = '#0F6E56';
const PAGE_SIZE = 30;

function mapTrip(t) {
  return {
    id: t.id, driver: t.driver,
    startTime: new Date(t.start_time).getTime(),
    endTime: new Date(t.end_time).getTime(),
    totalCost: t.total_cost, tollCount: t.toll_count,
    routes: t.routes || [], crossings: t.crossings || [],
  };
}

export default function HistoryScreen() {
  const { user } = useUser();
  const [allTrips, setAllTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [expandedTrip, setExpandedTrip] = useState(null);

  const load = useCallback(async (replace = true) => {
    if (user.isDemo) {
      setAllTrips(DEMO_TRIPS);
      setHasMore(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const offset = replace ? 0 : allTrips.length;
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('driver', user.name)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const mapped = (data || []).map(mapTrip);
    setAllTrips(prev => replace ? mapped : [...prev, ...mapped]);
    setHasMore((data || []).length === PAGE_SIZE);
    setLoading(false);
    setRefreshing(false);
  }, [user.name, user.isDemo, allTrips.length]);

  useEffect(() => { load(true); }, [user.name]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [user.name]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = allTrips.filter(t => {
      const d = new Date(t.startTime);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalGastado = allTrips.reduce((s, t) => s + t.totalCost, 0);
    const totalPeajes = allTrips.reduce((s, t) => s + t.tollCount, 0);
    const gastoMes = thisMonth.reduce((s, t) => s + t.totalCost, 0);
    const viajesMes = thisMonth.length;
    const promedio = allTrips.length > 0 ? Math.round(totalGastado / allTrips.length) : 0;
    return { totalViajes: allTrips.length, totalGastado, totalPeajes, gastoMes, viajesMes, promedio };
  }, [allTrips]);

  if (loading) {
    return <View style={s.center}><Text style={s.loadingText}>Cargando...</Text></View>;
  }

  if (allTrips.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>Sin viajes</Text>
        <Text style={s.emptyHint}>Apareceran aqui al detener un viaje</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
    >
      {/* Total card */}
      <View style={s.totalCard}>
        <Text style={s.totalLabel}>Total acumulado</Text>
        <Text style={s.totalAmount}>{formatCLP(stats.totalGastado)}</Text>
        <View style={s.totalRow}>
          <View>
            <Text style={s.totalStat}>{stats.totalViajes}</Text>
            <Text style={s.totalStatLabel}>viajes</Text>
          </View>
          <View>
            <Text style={s.totalStat}>{stats.totalPeajes}</Text>
            <Text style={s.totalStatLabel}>peajes</Text>
          </View>
          <View>
            <Text style={s.totalStat}>{formatCLP(stats.promedio)}</Text>
            <Text style={s.totalStatLabel}>promedio</Text>
          </View>
        </View>
      </View>

      {/* This month */}
      <View style={s.monthCard}>
        <View>
          <Text style={s.monthLabel}>Este mes</Text>
          <Text style={s.monthAmount}>{formatCLP(stats.gastoMes)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.monthStat}>{stats.viajesMes}</Text>
          <Text style={s.monthLabel}>viajes</Text>
        </View>
      </View>

      {/* Trips */}
      <Text style={s.sectionTitle}>RECIENTES</Text>
      {allTrips.map(trip => {
        const cx = trip.crossings || [];
        const isOpen = expandedTrip === trip.id;
        const tripName = trip.routes.length > 0
          ? trip.routes.join(' > ')
          : cx.length > 0
            ? `${cx[0].tollNombre} > ${cx[cx.length - 1].tollNombre}`
            : 'Viaje';

        return (
          <TouchableOpacity
            key={trip.id}
            style={s.tripCard}
            onPress={() => setExpandedTrip(isOpen ? null : trip.id)}
          >
            <View style={s.tripHeader}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={s.tripName} numberOfLines={1}>{tripName}</Text>
                <Text style={s.tripMeta}>
                  {formatDate(trip.startTime)} {'\u00B7'} {formatTime(trip.startTime)} {'\u00B7'} {cx.length} peajes
                </Text>
              </View>
              <Text style={s.tripCost}>{formatCLP(trip.totalCost)}</Text>
            </View>
            {isOpen && cx.length > 0 && (
              <View style={s.tripDetail}>
                {cx.map((c, i) => (
                  <View key={i} style={s.detailRow}>
                    <Text style={s.detailName}>{c.tollNombre}</Text>
                    <Text style={s.detailCost}>{formatCLP(c.tarifa)}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
      {hasMore && (
        <TouchableOpacity style={s.loadMore} onPress={() => load(false)}>
          <Text style={s.loadMoreText}>Cargar más</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888' },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  emptyHint: { fontSize: 14, color: '#888', marginTop: 4 },

  totalCard: { backgroundColor: PRIMARY, borderRadius: 20, padding: 20, marginBottom: 12 },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  totalAmount: { fontSize: 38, fontWeight: '700', color: '#fff', marginTop: 4 },
  totalRow: { flexDirection: 'row', gap: 24, marginTop: 16 },
  totalStat: { fontSize: 20, fontWeight: '700', color: '#fff' },
  totalStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

  monthCard: { backgroundColor: '#f5f5f5', borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  monthLabel: { fontSize: 12, color: '#888' },
  monthAmount: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginTop: 2 },
  monthStat: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },

  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#888', letterSpacing: 1, marginBottom: 8 },
  tripCard: { backgroundColor: '#f5f5f5', borderRadius: 16, padding: 16, marginBottom: 8 },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tripName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  tripMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  tripCost: { fontSize: 17, fontWeight: '700', color: PRIMARY },
  tripDetail: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailName: { fontSize: 13, color: '#666' },
  detailCost: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  loadMore: { alignItems: 'center', paddingVertical: 16 },
  loadMoreText: { fontSize: 14, color: PRIMARY, fontWeight: '600' },
});

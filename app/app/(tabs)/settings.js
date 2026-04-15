import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useUser } from '../_layout';
import { supabase } from '../../src/lib/supabase';
import { formatCLP } from '../../src/lib/format';

const PRIMARY = '#0F6E56';

export default function SettingsScreen() {
  const { user, logout } = useUser();
  const [limitInput, setLimitInput] = useState('');
  const [currentLimit, setCurrentLimit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('budgets').select('monthly_limit').eq('user_name', user.name).single()
      .then(({ data }) => {
        const v = data?.monthly_limit || 0;
        setCurrentLimit(v);
        setLimitInput(v > 0 ? String(v) : '');
      });
  }, [user.name]);

  const handleSave = async () => {
    const val = parseInt(limitInput.replace(/\D/g, ''), 10) || 0;
    setSaving(true);
    const { error } = await supabase.from('budgets').upsert(
      { user_name: user.name, monthly_limit: val },
      { onConflict: 'user_name' }
    );
    setSaving(false);
    if (!error) {
      setCurrentLimit(val);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Profile */}
      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={s.profileName}>{user.name}</Text>
          {user.email && <Text style={s.profileEmail}>{user.email}</Text>}
        </View>
      </View>

      {/* Budget */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>PRESUPUESTO MENSUAL</Text>
        <View style={s.card}>
          {currentLimit > 0 && (
            <Text style={s.currentLimit}>Límite actual: {formatCLP(currentLimit)}</Text>
          )}
          <Text style={s.inputLabel}>Nuevo límite</Text>
          <View style={s.inputRow}>
            <Text style={s.currencyPrefix}>$</Text>
            <TextInput
              style={s.input}
              value={limitInput}
              onChangeText={t => setLimitInput(t.replace(/\D/g, ''))}
              placeholder="0"
              placeholderTextColor="#bbb"
              keyboardType="number-pad"
              maxLength={8}
            />
          </View>
          <Text style={s.hint}>Verás una barra de progreso en el inicio cuando lo definas</Text>
          <TouchableOpacity
            style={[s.saveButton, saving && s.disabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={s.saveButtonText}>
              {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={s.logoutButton} onPress={handleLogout}>
        <Text style={s.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <Text style={s.version}>TAGcontrol · Blooming</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 48 },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#f5f5f5', borderRadius: 18, padding: 16, marginBottom: 24 },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  profileName: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  profileEmail: { fontSize: 13, color: '#888', marginTop: 2 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 1, marginBottom: 8 },
  card: { backgroundColor: '#f5f5f5', borderRadius: 18, padding: 16 },
  currentLimit: { fontSize: 13, color: '#555', marginBottom: 12 },
  inputLabel: { fontSize: 13, color: '#888', marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, marginBottom: 8 },
  currencyPrefix: { fontSize: 18, color: '#888', marginRight: 4 },
  input: { flex: 1, fontSize: 22, fontWeight: '600', color: '#1a1a1a', paddingVertical: 12 },
  hint: { fontSize: 12, color: '#aaa', marginBottom: 14, lineHeight: 16 },
  saveButton: { backgroundColor: PRIMARY, borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  disabled: { opacity: 0.5 },

  logoutButton: { borderRadius: 13, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0', marginTop: 8 },
  logoutText: { fontSize: 15, color: '#e53935', fontWeight: '500' },

  version: { textAlign: 'center', fontSize: 11, color: '#ccc', marginTop: 28 },
});

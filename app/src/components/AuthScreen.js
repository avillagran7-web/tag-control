import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';

const PRIMARY = '#0F6E56';

export default function AuthScreen({ onLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  const canSubmit = name.trim() && pin.length === 4 && (!needsEmail || email.trim());

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');

    if (needsEmail && pendingUser) {
      // Existing user adding email
      const ok = await onLogin(pendingUser.name, pin, email.trim());
      if (!ok) setError('Error al guardar email');
      setLoading(false);
      return;
    }

    const result = await onLogin(name.trim(), pin, email.trim() || undefined);
    if (result === 'needsEmail') {
      setNeedsEmail(true);
      setPendingUser({ name: name.trim() });
      setError('');
    } else if (!result) {
      setError('PIN incorrecto');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        <View style={s.iconWrap}>
          <Text style={s.iconText}>TC</Text>
        </View>
        <Text style={s.title}>TAGcontrol</Text>
        <Text style={s.subtitle}>Tu peaje, bajo control</Text>

        {needsEmail ? (
          <>
            <Text style={s.emailPrompt}>Hola {pendingUser?.name}, agrega tu email para continuar</Text>
            <TextInput
              style={s.input}
              placeholder="tu@email.com"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </>
        ) : (
          <>
            <TextInput
              style={s.input}
              placeholder="Tu nombre"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <TextInput
              style={s.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={s.input}
              placeholder="PIN (4 digitos)"
              placeholderTextColor="#999"
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
          </>
        )}

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[s.button, !canSubmit && s.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !canSubmit}
        >
          <Text style={s.buttonText}>{loading ? 'Entrando...' : 'Entrar'}</Text>
        </TouchableOpacity>

        <Text style={s.hint}>
          {needsEmail ? 'Solo lo usamos para tu cuenta' : 'Si es tu primera vez, se crea tu cuenta'}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  card: { width: '100%', maxWidth: 340, alignItems: 'center' },
  iconWrap: { width: 64, height: 64, borderRadius: 16, backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  iconText: { color: '#fff', fontWeight: '800', fontSize: 22 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 32 },
  emailPrompt: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  input: { width: '100%', backgroundColor: '#f5f5f5', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#1a1a1a', marginBottom: 12 },
  error: { color: '#e53935', fontSize: 13, marginBottom: 8 },
  button: { width: '100%', backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  hint: { fontSize: 12, color: '#aaa', marginTop: 12, textAlign: 'center' },
});

import { useState } from 'react';
import { getCurrentUser, loginUser, registerUser, logout } from '../lib/auth';

export default function AuthGate({ children }) {
  const [user, setUser] = useState(() => {
    try { return getCurrentUser(); } catch { return null; }
  });
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return children({ user, logout: () => { logout(); setUser(null); } });
  }

  const handleSubmit = async () => {
    if (!name.trim() || pin.length !== 4) {
      setError('Escribe tu nombre y un PIN de 4 dígitos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (mode === 'register') {
        const u = await registerUser(name.trim(), pin);
        setUser(u);
      } else {
        const u = await loginUser(name.trim(), pin);
        setUser(u);
      }
    } catch (err) {
      setError(err.message || 'Error de conexión');
    }
    setLoading(false);
  };

  // Estilos inline como fallback por si Tailwind no carga en Safari iOS
  return (
    <div style={{ minHeight: '100vh', background: '#F7F5F1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 320 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <svg width="64" height="64" viewBox="0 0 100 100" style={{ margin: '0 auto 12px' }}>
            <rect width="100" height="100" rx="20" fill="#5C6B5A" />
            <text x="50" y="68" fontSize="50" fontFamily="system-ui" fontWeight="700" fill="#F7F5F1" textAnchor="middle">TC</text>
          </svg>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>Tag Control</p>
          <p style={{ fontSize: 14, color: '#8B7D6B', margin: '4px 0 0' }}>Tu peaje, bajo control</p>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', background: '#EDECEA', borderRadius: 12, padding: 4, marginBottom: 20 }}>
          <button
            onClick={() => { setMode('login'); setError(''); }}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              background: mode === 'login' ? '#1A1A1A' : 'transparent',
              color: mode === 'login' ? '#F7F5F1' : '#8B7D6B',
            }}
          >
            Entrar
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              background: mode === 'register' ? '#1A1A1A' : 'transparent',
              color: mode === 'register' ? '#F7F5F1' : '#8B7D6B',
            }}
          >
            Registrarse
          </button>
        </div>

        {/* Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#8B7D6B', display: 'block', marginBottom: 4 }}>Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Raul"
              autoFocus
              style={{
                width: '100%', background: '#EDECEA', border: 'none', borderRadius: 12,
                padding: '12px 16px', fontSize: 14, color: '#1A1A1A', boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#8B7D6B', display: 'block', marginBottom: 4 }}>PIN (4 dígitos)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="****"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              style={{
                width: '100%', background: '#EDECEA', border: 'none', borderRadius: 12,
                padding: '12px 16px', fontSize: 14, color: '#1A1A1A', boxSizing: 'border-box',
                textAlign: 'center', letterSpacing: '0.3em', outline: 'none',
              }}
            />
          </div>
        </div>

        {error && (
          <p style={{ color: '#dc2626', fontSize: 12, textAlign: 'center', margin: '0 0 12px' }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '16px 0', borderRadius: 16, border: 'none',
            fontSize: 18, fontWeight: 700, cursor: 'pointer',
            background: loading ? '#8B7D6B' : '#1A1A1A', color: '#F7F5F1',
          }}
        >
          {loading ? 'Cargando...' : mode === 'register' ? 'Crear cuenta' : 'Entrar'}
        </button>

        <p style={{ fontSize: 12, color: '#8B7D6B', textAlign: 'center', marginTop: 16 }}>
          {mode === 'login'
            ? '¿Primera vez? Toca "Registrarse" arriba'
            : 'Elige un nombre y PIN que puedas recordar'}
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { getCurrentUser, loginUser, registerUser, logout } from '../lib/auth';

export default function AuthGate({ children }) {
  const [user, setUser] = useState(() => {
    try { return getCurrentUser(); } catch { return null; }
  });
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return children({ user, logout: () => { logout(); setUser(null); } });
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Escribe tu nombre'); return; }
    if (pin.length !== 4) { setError('El PIN debe tener 4 dígitos'); return; }
    setLoading(true);
    setError('');
    try {
      const u = mode === 'register'
        ? await registerUser(name.trim(), pin)
        : await loginUser(name.trim(), pin);
      setUser(u);
    } catch (err) {
      setError(err.message || 'Error de conexión. Intenta de nuevo.');
    }
    setLoading(false);
  };

  const s = {
    page: { minHeight: '100vh', background: '#FFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' },
    wrap: { width: '100%', maxWidth: 340 },
    logo: { width: 72, height: 72, borderRadius: 18, background: '#2D6A4F', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 12px rgba(45,106,79,0.3)' },
    input: { width: '100%', background: '#F8F9FA', border: '1.5px solid #E9ECEF', borderRadius: 12, padding: '14px 16px', fontSize: 17, color: '#212529', boxSizing: 'border-box', outline: 'none' },
    btn: (active) => ({ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', background: active ? '#FFF' : 'transparent', color: active ? '#212529' : '#868E96', boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }),
    submit: { width: '100%', padding: '16px 0', borderRadius: 14, border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer', background: loading ? '#ADB5BD' : '#2D6A4F', color: '#FFF', boxShadow: loading ? 'none' : '0 2px 8px rgba(45,106,79,0.3)' },
  };

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={s.logo}>
            <svg viewBox="0 0 512 512" style={{ width: 42, height: 42 }}>
              <path d="M256 80c-70 0-126 56-126 126 0 90 126 210 126 210s126-120 126-210c0-70-56-126-126-126z" fill="#fff" opacity="0.95"/>
              <circle cx="256" cy="206" r="56" fill="#2D6A4F"/>
              <path d="M232 210 L250 228 L284 188" fill="none" stroke="#A7F3D0" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#212529', margin: '0 0 4px', letterSpacing: '-0.5px' }}>Tag Control</h1>
          <p style={{ fontSize: 15, color: '#868E96', margin: 0 }}>Controla tus gastos en peajes</p>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', background: '#F8F9FA', borderRadius: 12, padding: 3, marginBottom: 24 }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }} style={s.btn(mode === m)}>
              {m === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#495057', display: 'block', marginBottom: 6 }}>Tu nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Raul"
              style={s.input}
            />
          </div>
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#495057', display: 'block', marginBottom: 6 }}>PIN</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4 dígitos"
                style={{ ...s.input, fontSize: 24, textAlign: 'center', letterSpacing: '0.5em', paddingRight: 48 }}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#868E96', fontSize: 13, cursor: 'pointer' }}
              >
                {showPin ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          {error && (
            <p style={{ color: '#DC3545', fontSize: 14, textAlign: 'center', margin: 0 }}>{error}</p>
          )}

          <button type="submit" disabled={loading} style={s.submit}>
            {loading ? 'Cargando...' : mode === 'register' ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        <p style={{ fontSize: 14, color: '#868E96', textAlign: 'center', margin: 0 }}>
          {mode === 'login' ? (
            <>¿Primera vez? Toca <strong style={{ color: '#495057' }}>"Crear cuenta"</strong></>
          ) : (
            'Elige un nombre y PIN fácil de recordar'
          )}
        </p>
      </div>
    </div>
  );
}

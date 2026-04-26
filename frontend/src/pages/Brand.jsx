import { useState } from 'react';
import papaHtml from '../assets/brand/papa.html?raw';
import expertosHtml from '../assets/brand/expertos.html?raw';

export default function Brand() {
  const [active, setActive] = useState('A');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      background: '#0D0D0D',
      overflow: 'hidden',
    }}>
      {/* Switcher */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '10px 16px',
        borderBottom: '1px solid #1e1e1e',
      }}>
        <span style={{ fontSize: 11, color: '#444', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginRight: 4, fontFamily: 'system-ui' }}>
          TAGcontrol · Brand
        </span>
        <div style={{ display: 'flex', background: '#1a1a1a', borderRadius: 100, padding: 4, gap: 2, border: '1px solid #2a2a2a' }}>
          <button
            onClick={() => setActive('A')}
            style={{
              padding: '7px 20px',
              borderRadius: 100,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'system-ui',
              transition: 'all 0.18s ease',
              background: active === 'A' ? '#C8FF00' : 'transparent',
              color: active === 'A' ? '#0D0D0D' : '#555',
            }}
          >
            A · Tu elección
          </button>
          <button
            onClick={() => setActive('B')}
            style={{
              padding: '7px 20px',
              borderRadius: 100,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'system-ui',
              transition: 'all 0.18s ease',
              background: active === 'B' ? '#0A6E50' : 'transparent',
              color: active === 'B' ? '#fff' : '#555',
            }}
          >
            B · Expertos
          </button>
        </div>
      </div>

      {/* Content frames */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <iframe
          srcDoc={papaHtml}
          title="Propuesta A"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            border: 'none',
            opacity: active === 'A' ? 1 : 0,
            pointerEvents: active === 'A' ? 'auto' : 'none',
            transition: 'opacity 0.2s ease',
          }}
        />
        <iframe
          srcDoc={expertosHtml}
          title="Propuesta B"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            border: 'none',
            opacity: active === 'B' ? 1 : 0,
            pointerEvents: active === 'B' ? 'auto' : 'none',
            transition: 'opacity 0.2s ease',
          }}
        />
      </div>
    </div>
  );
}

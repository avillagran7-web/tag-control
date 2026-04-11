import { Component, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import PlanRoute from './pages/PlanRoute';
import History from './pages/History';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import AuthGate from './components/AuthGate';

// Contexto global del usuario
export const UserContext = createContext(null);
export function useUser() { return useContext(UserContext); }

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <h2>Algo salió mal</h2>
          <p style={{ color: '#888', fontSize: 14 }}>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 24px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16 }}>
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const navItems = [
  {
    to: '/',
    label: 'Inicio',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
  },
  {
    to: '/planificar',
    label: 'Planificar',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    to: '/historial',
    label: 'Historial',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

function AppShell({ user, logout }) {
  return (
    <UserContext.Provider value={{ user, logout }}>
      <div className="max-w-[390px] mx-auto min-h-screen bg-cream flex flex-col relative shadow-2xl">
        <header className="bg-negro text-cream px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-7 h-7" viewBox="0 0 100 100">
              <rect width="100" height="100" rx="20" fill="#5C6B5A" />
              <text x="50" y="68" fontSize="50" fontFamily="system-ui" fontWeight="700" fill="#F7F5F1" textAnchor="middle">TC</text>
            </svg>
            <span className="font-bold text-lg">Tag Control</span>
          </div>
          <button onClick={logout} className="text-xs text-tierra active:text-cream">
            {user.name} &middot; Salir
          </button>
        </header>

        <main className="flex-1 overflow-y-auto pb-20">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/planificar" element={<PlanRoute />} />
              <Route path="/historial" element={<History />} />
              </Routes>
          </ErrorBoundary>
        </main>

        <nav className="absolute bottom-0 left-0 right-0 bg-cream border-t border-cream-dark">
          <div className="flex justify-around items-center h-16">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 text-xs transition-colors ${
                    isActive ? 'text-primary' : 'text-tierra'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </UserContext.Provider>
  );
}

function RouterRoot() {
  const location = useLocation();
  if (location.pathname === '/admin') return <Admin />;

  return (
    <AuthGate>
      {({ user, logout }) => <AppShell user={user} logout={logout} />}
    </AuthGate>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RouterRoot />
    </BrowserRouter>
  );
}

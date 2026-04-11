import { Component, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import PlanRoute from './pages/PlanRoute';
import History from './pages/History';
import Admin from './pages/Admin';
import AuthGate from './components/AuthGate';

export const UserContext = createContext(null);
export function useUser() { return useContext(UserContext); }

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
          <p className="text-lg font-semibold text-text mb-2">Algo salió mal</p>
          <p className="text-sm text-text-secondary mb-4">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-white rounded-xl font-semibold"
          >
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
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
  },
  {
    to: '/planificar',
    label: 'Rutas',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    to: '/historial',
    label: 'Historial',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

function AppShell({ user, logout }) {
  return (
    <UserContext.Provider value={{ user, logout }}>
      <div className="max-w-[430px] mx-auto min-h-screen bg-surface flex flex-col relative shadow-2xl">
        {/* Header Apple-style */}
        <header className="bg-surface/80 backdrop-blur-xl border-b border-surface-tertiary/50 px-5 py-3 flex items-center justify-between sticky top-0 z-40" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold">TC</span>
            </div>
            <span className="font-semibold text-text text-[17px] tracking-tight">Tag Control</span>
          </div>
          <button
            onClick={() => { if (window.confirm('¿Cerrar sesión?')) logout(); }}
            className="text-[13px] text-text-secondary active:text-primary transition-colors flex items-center gap-1"
          >
            {user.name}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto pb-24">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/planificar" element={<PlanRoute />} />
              <Route path="/historial" element={<History />} />
            </Routes>
          </ErrorBoundary>
        </main>

        {/* Tab bar Apple-style */}
        <nav className="absolute bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-xl border-t border-surface-tertiary/50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex justify-around items-center h-[56px] pt-1 pb-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 transition-colors ${
                    isActive ? 'text-primary' : 'text-text-tertiary'
                  }`
                }
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
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

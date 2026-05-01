import { useEffect, useState, createContext, useContext } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getStoredUser, login, logout } from '../src/lib/auth';
import { demoLogin } from '../src/lib/demoData';
import AuthScreen from '../src/components/AuthScreen';

export const UserContext = createContext(null);
export function useUser() { return useContext(UserContext); }

export default function RootLayout() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStoredUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  if (!user) {
    return (
      <>
        <StatusBar style="dark" />
        <AuthScreen
          onLogin={async (name, pin, email) => {
            const result = await login(name, pin, email);
            if (result.error) return false;
            if (result.needsEmail) return 'needsEmail';
            if (result.user) { setUser(result.user); return true; }
            return false;
          }}
          onDemoLogin={async () => {
            const demoUser = await demoLogin();
            setUser(demoUser);
          }}
        />
      </>
    );
  }

  return (
    <UserContext.Provider value={{
      user,
      logout: async () => { await logout(); setUser(null); },
    }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </UserContext.Provider>
  );
}

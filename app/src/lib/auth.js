import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const USER_KEY = 'tagcontrol_user';

export async function getStoredUser() {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Login: existing user (name + pin) or register new user (name + pin + email).
 * For existing users without email, returns { needsEmail: true, user } so the
 * UI can ask for it.
 */
export async function login(name, pin, email) {
  // Check if user exists with this name + pin
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('name', name)
    .eq('pin', pin)
    .single();

  if (existing) {
    // Existing user — update email if provided and missing
    if (email && !existing.email) {
      await supabase.from('users').update({ email }).eq('name', name);
      existing.email = email;
    }
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(existing));
    // If still no email, flag it
    if (!existing.email && !email) {
      return { needsEmail: true, user: existing };
    }
    return { user: existing };
  }

  // Check if name exists (wrong PIN)
  const { data: byName } = await supabase
    .from('users')
    .select('name')
    .eq('name', name)
    .single();

  if (byName) return { error: 'PIN incorrecto' };

  // Register new user — email required
  if (!email) return { error: 'Ingresa tu email para registrarte' };

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ name, pin, email })
    .select()
    .single();

  if (error) return { error: 'Error al registrar' };

  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser));
  return { user: newUser };
}

export async function updateEmail(name, email) {
  await supabase.from('users').update({ email }).eq('name', name);
  // Update stored user
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (raw) {
    const user = JSON.parse(raw);
    user.email = email;
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    return user;
  }
}

export async function logout() {
  await SecureStore.deleteItemAsync(USER_KEY);
}

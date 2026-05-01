import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const USER_KEY = 'tagcontrol_user';

// ── PIN hashing ───────────────────────────────────────────────────────────────
// PINs are stored as SHA-256(name:pin) so the DB never holds plaintext.
// Salt includes the username so two users with the same PIN get different hashes.
// Migration: on first login after this deploy, plaintext PINs are detected and
// silently upgraded to hashed form.

async function hashPin(name, pin) {
  const data = new TextEncoder().encode(`${name}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────────────────────────

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
  // Fetch canonical name first so the hash always uses the name as stored in DB.
  // iOS auto-capitalizes the name field ("Revisor" vs "revisor"), which would
  // produce a different SHA-256 hash and cause a false "PIN incorrecto" error.
  const { data: nameRow } = await supabase
    .from('users')
    .select('name')
    .ilike('name', name)
    .single();
  const canonicalName = nameRow?.name ?? name;

  const hashed = await hashPin(canonicalName, pin);

  // Try hashed PIN first (new standard).
  let { data: existing } = await supabase
    .from('users')
    .select('*')
    .ilike('name', name)
    .eq('pin', hashed)
    .single();

  // Migration path: if not found by hash, try plaintext (pre-hash users)
  if (!existing) {
    const { data: legacy } = await supabase
      .from('users')
      .select('*')
      .ilike('name', name)
      .eq('pin', pin)
      .single();

    if (legacy) {
      // Upgrade plaintext PIN to hashed in the background
      await supabase.from('users').update({ pin: hashed }).eq('name', canonicalName);
      legacy.pin = hashed;
      existing = legacy;
    }
  }

  if (existing) {
    if (email && !existing.email) {
      await supabase.from('users').update({ email }).eq('name', canonicalName);
      existing.email = email;
    }
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(existing));
    if (!existing.email && !email) {
      return { needsEmail: true, user: existing };
    }
    return { user: existing };
  }

  // nameRow already tells us if this name exists (wrong PIN vs new user)
  if (nameRow) return { error: 'PIN incorrecto' };

  // Register new user — email required
  if (!email) return { error: 'Ingresa tu email para registrarte' };

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ name, pin: hashed, email })
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

export async function deleteAccount(name) {
  // Get all trip IDs to cascade-delete crossings and positions
  const { data: trips } = await supabase.from('trips').select('id').eq('driver', name);
  const { data: liveTrips } = await supabase.from('live_trips').select('id').eq('driver', name);
  const tripIds = [...(trips || []), ...(liveTrips || [])].map(t => t.id);

  if (tripIds.length > 0) {
    await supabase.from('live_crossings').delete().in('trip_id', tripIds);
    await supabase.from('positions').delete().in('trip_id', tripIds);
  }
  await supabase.from('trips').delete().eq('driver', name);
  await supabase.from('live_trips').delete().eq('driver', name);
  await supabase.from('budgets').delete().eq('user_name', name);
  await supabase.from('users').delete().eq('name', name);
  await SecureStore.deleteItemAsync(USER_KEY);
}

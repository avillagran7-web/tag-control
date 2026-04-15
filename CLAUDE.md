# TAGcontrol

PWA + app nativa para tracking automático de peajes en autopistas de Chile.
Detecta cruces GPS en tiempo real, calcula tarifas, y lleva historial por conductor.

## Stack
- **PWA (`frontend/`):** React 19 + Vite + Tailwind 4 + Supabase. Deploy en Vercel.
- **App nativa (`app/`):** React Native + Expo SDK 54 + expo-location background. Build via EAS.
- **Backend:** Supabase (misma instancia para ambos clientes)
- **Admin:** Web-only en `/admin` — dashboard operacional, no va en la app nativa

## Comandos rápidos

```sh
# PWA
cd frontend && npm run dev          # dev server
cd frontend && npm run build        # build → deploy automático con git push (Vercel)

# App nativa
cd app && npx expo start            # dev con Expo Go
cd app && npx eas-cli build --platform android --profile preview  # APK de distribución

# Scripts de mantenimiento
node scripts/check-shared-drift.mjs         # verifica que frontend/ y app/ estén sincronizados
node scripts/check-shared-drift.mjs --fix   # sincroniza app/ desde frontend/ (canonical)
node scripts/code-review-agent.mjs --staged --strict  # code review antes de commitear
node scripts/analytics-agent.mjs --days=7 --format=whatsapp  # resumen semanal
node scripts/gps-calibration-agent.mjs --days=7  # propone calibraciones de peajes
node scripts/gps-calibration-agent.mjs --apply --pr  # aplica + crea PR en GitHub
node scripts/release-agent.mjs              # build Android + genera link de descarga
```

## Archivos clave

### Shared logic (idéntica en `frontend/src/` y `app/src/`)
> Metro (React Native) no resuelve imports fuera de `app/`, por eso están duplicados.
> `frontend/` es **canonical**. Siempre editar ahí y sincronizar con `--fix`.

| Archivo | Descripción |
|---|---|
| `data/tolls.json` | 80+ peajes con coordenadas GPS, radio de detección, tarifas |
| `lib/pricing.js` | Tarifas por horario (semana / punta / saturación) |
| `lib/inference.js` | Inferencia de peajes faltantes (túneles, gaps GPS) |
| `lib/geoUtils.js` | Haversine, foot-of-perpendicular, conversión de velocidades |
| `lib/format.js` | Formato CLP, fecha, hora (locale es-CL) |

### PWA (`frontend/src/`)
| Archivo | Descripción |
|---|---|
| `hooks/useGPS.js` | GPS watchdog, detección segment-based por proximidad |
| `hooks/useTrip.js` | Ciclo completo de un viaje: inicio, detección, cierre |
| `lib/liveTracking.js` | Supabase: upsert posición, crossings, cleanup, retry 3x |
| `lib/sound.js` | Alerta de peaje + audio keep-alive para background iOS |
| `lib/backgroundService.js` | Service Worker + notificaciones para Android |
| `lib/reconstruction.js` | Reconstrucción retroactiva desde posiciones GPS (24h cache) |
| `lib/qaAgent.js` | QA Agent: detecta anomalías en tiempo real (viajes 0 peajes, etc.) |
| `pages/Home.jsx` | UI principal, ciclo de viaje |
| `pages/History.jsx` | Historial de viajes con filtros |
| `pages/Admin.jsx` | Dashboard admin (PIN: 2026) — tabs: Live, DB, Arquitectura |
| `pages/admin/AdminData.jsx` | Tab DB: QA findings, viajes en riesgo, tabla de cruces |
| `pages/admin/AdminArchitecture.jsx` | Tab Arquitectura: sistema + 5 agents con estado |

### App nativa (`app/src/`)
| Archivo | Descripción |
|---|---|
| `lib/locationService.js` | GPS BACKGROUND REAL (expo-location TaskManager) + notificaciones push |
| `lib/liveTracking.js` | Supabase sync con retry + position queue offline |
| `lib/auth.js` | Login PIN + email + SecureStore (SHA-256 hash) |
| `components/AuthScreen.js` | Pantalla de login |

### App screens (`app/app/`)
| Archivo | Descripción |
|---|---|
| `_layout.js` | Root: auth + user context |
| `(tabs)/index.js` | Home: iniciar/detener viaje, detección en vivo |
| `(tabs)/history.js` | Historial de viajes con pull-to-refresh + paginación |
| `(tabs)/settings.js` | Perfil, límite mensual (budgets), logout |

## Supabase
- **Ref:** `nttnryildsxllxqfkkvz`
- **Tablas:** `trips`, `live_trips`, `live_crossings`, `positions` (cache 24h), `users`, `budgets`
- **Auth:** PIN-based — name + 4 dígitos + email. Hash SHA-256 via `crypto.subtle` (compatible Hermes/Expo SDK 54)
- **Credenciales:** anon key pública en los scripts. SERVICE_ROLE_KEY nunca en cliente.

## Detección de peajes

Pipeline (por orden de aplicación):

1. **GPS** — `BestForNavigation` (nativa) / `enableHighAccuracy` (PWA)
2. **Segment-based** — distancia al segmento A→B, no solo al punto GPS
3. **Speed + cooldown** — ≥15 km/h · 120s cooldown por peaje · `radio_deteccion_m` por peaje (150–400m)
4. **Inferencia real-time** — `inferMissingTolls()` detecta gaps en `ROUTE_SEQUENCES` durante el viaje
5. **Post-trip inference** — `inferPostTrip()` con timestamps via haversine / 90 km/h
6. **Reconstrucción GPS** — `reconstructFromPositions()` usa cache de posiciones (24h)
7. **Persistencia** — `trips` INSERT siempre (0 peajes incluidos) + retry 3x con backoff

## Coordenadas de peajes

Verificadas con GPS real de conductores. **No usar OSM** como fuente de verdad — es poco confiable en túneles.

Para recalibrar: `node scripts/gps-calibration-agent.mjs --days=7` — requiere ≥3 pasadas por peaje.
Shifts >200m se marcan como sospechosos (posible ruido GPS o túnel) y no se aplican automáticamente.

## Agent Layer

Cinco agents operacionales en `scripts/`:

| Agent | Archivo | Trigger | Output |
|---|---|---|---|
| QA Agent | `lib/qaAgent.js` | Cada carga de Admin | Alertas en tab DB |
| GPS Calibration | `gps-calibration-agent.mjs` | Manual / periódico | PR con tolls.json actualizado |
| Code Review | `code-review-agent.mjs` | Pre-commit / manual | Exit 1 si errores críticos |
| Release | `release-agent.mjs` | Manual / merge a main | APK + mensaje WhatsApp |
| Analytics | `analytics-agent.mjs` | Manual / cron 08:00 | Resumen ejecutivo + WhatsApp |

## Convenciones de scripts

- Read-only por default; escritura requiere `--apply`, `--fix`, o `--commit`
- Credenciales desde código (anon key solo) — no service role en scripts
- Nuevos one-offs: nombrar por incidente (`fix-X-trip.mjs`) para saber cuándo eliminarlos
- Ver `scripts/README.md` para documentación completa

## Build & Deploy

| Canal | Cómo |
|---|---|
| PWA | `git push` → Vercel auto-deploy |
| Android APK | `node scripts/release-agent.mjs` o EAS directo |
| iOS | Pendiente Apple Developer account → EAS build → TestFlight |
| Expo org | `@andrespanthervillagran/tagcontrol` (ID: `adeffd89-13d6-43fa-8516-36bfa26fd206`) |

# TAGcontrol — Roadmap

No hay fechas. Construimos en bloques de valor. Un día de trabajo intenso vale más que un mes de calendario.

---

## ✅ Construido

- GPS detection pipeline — segment-based, speed+cooldown, inferencia, reconstrucción 24h
- Supabase backend — trips, live_trips, live_crossings, positions, users, budgets
- PWA (React 19 + Vite + Tailwind 4) — canal original, 21 usuarios activos
- App nativa (React Native + Expo SDK 54) — background GPS real, notificaciones push
- Admin dashboard — tabs Live, DB, Arquitectura con QA findings y at-risk trips
- Agent layer — QA, GPS Calibration, Analytics, Code Review, Release
- Apple App Store — Build 5 submitted (PrivacyInfo, privacy policy, location fallback)
- Auth PIN-based — SHA-256 hash, SecureStore nativa, compatible Hermes/Expo SDK 54
- Inferencia de peajes — túneles, gaps GPS, ROUTE_SEQUENCES
- Build & deploy — EAS (iOS/Android) + Vercel auto-deploy

---

## 🔨 En progreso

- Apple App Store review — Build 5 bajo revisión (credenciales: revisor / 2026)
- 100 usuarios activos con detección 100% precisa

---

## 📋 Por construir — en orden de prioridad

### Bloque 0 — Insight crítico del audit hackathon
> El botón "Iniciar viaje" es el mayor problema de producto. Un conductor no-técnico
> lo va a olvidar. La app tiene que ser más inteligente que el usuario.
- [ ] Auto-detección de viaje — speed ≥60 km/h + geofence de entrada a autopista → trip start automático
- [ ] Conectar cuenta TAG en onboarding → scraper activo desde el primer día (no fase 2, es día 1)
- [ ] "Atrapé un error de cobro" → momento viral primario del producto

### Bloque 1 — Base sólida
- [x] README top-level en GitHub
- [x] ROADMAP.md vivo
- [x] Admin status board en vivo (métricas live, estado de agents, build status)
- [ ] MCP → Supabase (contexto live de DB en cada sesión de desarrollo)
- [ ] Auditoría de precisión con los 21 usuarios — detectar peajes que se pierden
- [ ] Push notifications iOS — resumen al terminar viaje

### Bloque 2 — El diferenciador vs competencia
- [ ] Scraper layer — Claude Computer Use → portales autopistas
  - autopistascentral.cl · costaneranorte.cl · autopistassol.cl · vespucionorte.cl
  - Usuario conecta su cuenta TAG → reconciliación GPS vs cobros reales
- [ ] Alertas de error de cobro — "te cobraron 2 veces este peaje"
- [ ] Verificación de viaje completa — GPS detected + scraper confirmed = 100% fiable

### Bloque 3 — Escala
- [ ] Claude Managed Agents — agents en cloud de Anthropic, sin terminal local
- [ ] Fleet API — B2B empresas con flotas (SmartReport competitor)
- [ ] Expansión multi-país — Argentina, Colombia, México, Brasil

---

## 🔭 Visión

Una sola app para entender y controlar todo lo que gastas en autopistas — en Chile y en Latinoamérica.
No solo tracking: verificación, disputa de cobros, y transparencia total contra las concesionarias.

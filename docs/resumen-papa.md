# TAGcontrol — Cómo funciona y qué se construyó

El sistema detecta peajes usando el GPS del celular. Cuando pasas por una autopista, la app ve tu ubicación y la compara con un mapa de todos los pórticos de peaje de Chile. Si estás cerca de uno y vas a velocidad de autopista, lo registra y te avisa.

---

## Los problemas que teníamos y cómo se resolvieron

**Doble cobro en el mismo pórtico**
Algunos pórticos físicos tienen dos antenas separadas por pocos metros — una por carril o dirección. El GPS las veía como dos peajes distintos y cobraba dos veces por un solo cruce. Se resolvió agrupando las antenas que pertenecen al mismo punto físico. Ahora el sistema sabe que son la misma barrera y solo registra un cobro, sin importar cuál antena detecta primero.

**Túneles y zonas sin señal**
En túneles el GPS se pierde completamente. Si un conductor entra a uno con peaje, el celular queda ciego. Se resolvió con un sistema de inferencia: si el auto entró por un lado y salió por el otro, el sistema deduce que cruzó el peaje aunque no haya habido señal adentro.

**Tráfico en hora punta**
En las filas del peaje los autos van a 5 km/h o están detenidos. El sistema ahora recuerda que el conductor venía a alta velocidad y mantiene el registro activo aunque esté parado — porque el peaje igual se cobra.

**iPhone vs Android**
En Android la app corre en segundo plano sin problema. En iPhone, el sistema operativo intenta apagar el GPS para ahorrar batería cuando el auto parece quieto — exactamente lo que pasa esperando en un peaje. Se configuró para que iOS nunca pause el GPS durante un viaje, independiente de si el auto está detenido o en movimiento.

**El resultado**
El sistema ahora detecta correctamente en túneles, en tráfico, a alta velocidad, en iPhone y Android, sin cobrar doble en pórticos que comparten el mismo punto físico.

---

## Cómo está construido por dentro

TAGcontrol no es solo una app. Es un sistema con varias capas que trabajan juntas.

**La app que ve el conductor**
Existe en dos versiones que corren en paralelo. Una es la versión web — se abre desde el navegador sin descargar nada. La otra es la app nativa que va en la App Store de Apple y en Android. Ambas usan los mismos datos y la misma lógica de detección.

**El cerebro**
Toda la información — los peajes cruzados, los usuarios, los viajes, las posiciones GPS — vive en una base de datos en la nube que responde en tiempo real. Cuando un conductor cruza un peaje, el registro aparece en menos de un segundo.

**El equipo técnico**
Andres actúa como CTO — toma las decisiones de arquitectura, define qué se construye primero y por qué, y asegura que el sistema sea sólido antes de crecer. Para acelerar el desarrollo, trabaja con un equipo de agentes de inteligencia artificial especializados, cada uno con un rol distinto:

— **Agente de calidad** — revisa cada viaje en tiempo real buscando anomalías: cobros duplicados, rutas sin peajes donde siempre los hay, datos que no cuadran.
— **Agente de calibración GPS** — analiza datos reales de conductores y propone ajustes al mapa de pórticos cuando detecta que las coordenadas se desviaron.
— **Agente de código** — revisa cada cambio antes de que entre al sistema, como un segundo par de ojos técnico.
— **Agente de analytics** — genera resúmenes semanales del uso real: cuántos viajes, qué rutas, qué peajes se detectan más.
— **Agente de releases** — coordina la preparación de nuevas versiones para publicar en las tiendas.

En vez de contratar un equipo grande, el sistema está diseñado para que los agentes hagan el trabajo repetitivo y Andres se enfoque en las decisiones que realmente importan. Es como tener cinco especialistas disponibles las 24 horas, que no se cansan y no cometen errores de distracción.

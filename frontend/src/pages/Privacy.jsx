export default function Privacy() {
  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-surface px-6 py-10">
      <h1 className="text-2xl font-bold text-text mb-2">Política de Privacidad</h1>
      <p className="text-xs text-text-secondary mb-8">Última actualización: 20 de abril de 2026</p>

      <section className="mb-6">
        <h2 className="text-base font-semibold text-text mb-2">1. Quiénes somos</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          TAGcontrol es una aplicación de seguimiento de peajes para autopistas de Chile,
          desarrollada por Andres Villagran. Puedes contactarnos en a.villagran7@gmail.com.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-semibold text-text mb-2">2. Datos que recopilamos</h2>
        <ul className="text-sm text-text-secondary leading-relaxed space-y-2">
          <li><strong className="text-text">Ubicación GPS:</strong> Recopilamos tu posición en tiempo real mientras un viaje está activo. Esto es necesario para detectar automáticamente los peajes que cruzas.</li>
          <li><strong className="text-text">Historial de viajes:</strong> Guardamos los viajes realizados, los peajes cruzados y los costos asociados.</li>
          <li><strong className="text-text">Nombre y PIN:</strong> Usamos un nombre de usuario y PIN de 4 dígitos para identificarte. El PIN se almacena como hash SHA-256 — nunca en texto plano.</li>
          <li><strong className="text-text">Email (opcional):</strong> Solo para recuperación de cuenta.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-semibold text-text mb-2">3. Cómo usamos tu ubicación</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          La ubicación GPS se usa exclusivamente para detectar cruces de peajes mientras conduces.
          Cuando la app está en segundo plano (pantalla apagada), el GPS continúa activo solo durante
          un viaje activo. Nunca recopilamos ubicación fuera de un viaje activo.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-semibold text-text mb-2">4. Almacenamiento y seguridad</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Los datos se almacenan en Supabase (supabase.com), nuestro procesador de datos en la
          nube, que cumple con los estándares SOC 2 Type 2 y GDPR y proporciona el mismo nivel
          de protección descrito en esta política. Las posiciones GPS se eliminan automáticamente
          después de 24 horas. Los viajes e historial se conservan mientras tengas cuenta activa.
          No vendemos ni compartimos tus datos con terceros.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-semibold text-text mb-2">5. Tus derechos</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Puedes solicitar la eliminación de tu cuenta y todos tus datos en cualquier momento
          enviando un email a a.villagran7@gmail.com. Procesamos estas solicitudes en un plazo
          máximo de 30 días.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-semibold text-text mb-2">6. Menores de edad</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          TAGcontrol no está dirigido a menores de 13 años y no recopilamos conscientemente
          datos de menores.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-base font-semibold text-text mb-2">7. Cambios a esta política</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Podemos actualizar esta política ocasionalmente. Te notificaremos de cambios
          importantes a través de la app. El uso continuado de TAGcontrol después de los
          cambios implica aceptación de la nueva política.
        </p>
      </section>

      <p className="text-xs text-text-tertiary text-center">
        TAGcontrol · a.villagran7@gmail.com
      </p>
    </div>
  );
}

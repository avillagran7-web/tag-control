export default function History() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-gray-400">
      <svg className="w-16 h-16 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="font-medium text-gray-500">Historial</p>
      <p className="text-sm mt-1">Disponible en Fase 3</p>
    </div>
  );
}

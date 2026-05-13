"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-xl font-bold text-gray-800">Algo deu errado</h2>
      <p className="text-sm text-gray-500 max-w-md text-center">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-brand text-white rounded-xl text-sm hover:opacity-90"
      >
        Tentar novamente
      </button>
    </div>
  );
}

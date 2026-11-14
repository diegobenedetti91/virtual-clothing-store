import InteresseManager from "@/components/admin/InteresseManager";

export default function InteressePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Interesse por produto</h1>
        <p className="text-sm text-gray-500 mt-1">Quais peças chamam atenção e quais vendem. Avise por e-mail quem se interessou quando houver promoção, cupom ou preço menor.</p>
      </div>
      <InteresseManager />
    </div>
  );
}

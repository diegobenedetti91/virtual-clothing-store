import FlashSaleManager from "@/components/admin/FlashSaleManager";

export default function FlashSalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gray-900">⚡ Flash Sales</h1>
        <p className="text-gray-600 mt-1">Crie ofertas relâmpago com timer</p>
      </div>

      <FlashSaleManager />
    </div>
  );
}

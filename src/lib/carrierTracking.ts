// Carrier is inferred from the tracking code format: Correios uses the UPU pattern (AA123456789BR), Loggi codes come as "LGI-..."
export function getCarrierTracking(code: string): { carrier: string | null; url: string } {
  if (code.startsWith("LGI-")) {
    return { carrier: "Loggi", url: `https://www.melhorrastreio.com.br/app/loggi/${code}` };
  }
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code)) {
    return { carrier: "Correios", url: `https://www.melhorrastreio.com.br/app/correios/${code}` };
  }
  return { carrier: null, url: `https://www.melhorrastreio.com.br/rastreio/${code}` };
}

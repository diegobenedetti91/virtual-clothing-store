export const BRAZILIAN_REGIONS = {
  NORTE: {
    label: "Norte",
    states: ["AC", "AM", "AP", "PA", "RO", "RR", "TO"],
  },
  NORDESTE: {
    label: "Nordeste",
    states: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  },
  "CENTRO-OESTE": {
    label: "Centro-Oeste",
    states: ["DF", "GO", "MS", "MT"],
  },
  SUDESTE: {
    label: "Sudeste",
    states: ["ES", "MG", "RJ", "SP"],
  },
  SUL: {
    label: "Sul",
    states: ["PR", "RS", "SC"],
  },
};

export function getRegionForState(state: string): string | null {
  const upperState = state?.toUpperCase();
  for (const [region, data] of Object.entries(BRAZILIAN_REGIONS)) {
    if (data.states.includes(upperState)) {
      return region;
    }
  }
  return null;
}

export function getRegionsArray(regioesStr: string | null | undefined): string[] {
  if (!regioesStr) return [];
  return regioesStr.split("|").filter((r) => r.trim());
}

export function formatRegioesForSave(regioes: string[]): string | null {
  const filtered = regioes.filter((r) => r.trim());
  return filtered.length > 0 ? filtered.join("|") : null;
}

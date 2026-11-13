// Regras do cadastro do cliente — usadas no navegador (formulários) e no servidor (rotas).
// Sem imports de servidor aqui, para poder rodar nos dois lados.
import { isValidCPFOrCNPJ } from "@/lib/utils";

export const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export interface ProfileFields {
  name?: string | null;
  phone?: string | null;
  cpfCnpj?: string | null;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}
export type ProfileField = keyof ProfileFields;

/** Campos obrigatórios para comprar (os mesmos exigidos no cadastro por e-mail). */
export const REQUIRED_PROFILE_FIELDS: { key: ProfileField; label: string }[] = [
  { key: "name", label: "Nome completo" },
  { key: "phone", label: "Celular / WhatsApp" },
  { key: "cpfCnpj", label: "CPF ou CNPJ" },
  { key: "zipCode", label: "CEP" },
  { key: "street", label: "Rua / Avenida" },
  { key: "number", label: "Número" },
  { key: "neighborhood", label: "Bairro" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado (UF)" },
];

export const onlyDigits = (v: string | null | undefined) => (v || "").replace(/\D/g, "");

// ─── Máscaras ───
export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskCpfCnpj(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskCep(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// ─── Validações ───
export const isValidPhone = (v: string | null | undefined) => {
  const d = onlyDigits(v);
  return d.length === 10 || d.length === 11;
};
export const isValidCep = (v: string | null | undefined) => onlyDigits(v).length === 8;
export const isValidUf = (v: string | null | undefined) => UF_LIST.includes(((v || "").trim().toUpperCase()) as (typeof UF_LIST)[number]);
export const isValidEmail = (v: string | null | undefined) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || "").trim());

/**
 * Erro de formato de um campo (null = ok). Campo vazio não é erro aqui — ver `missingProfileFields`.
 * "Nome e sobrenome" é pedido só nos formulários, para não barrar no checkout clientes antigos com um nome só.
 */
export function fieldFormatError(key: ProfileField, value: string | null | undefined): string | null {
  const v = (value || "").trim();
  if (!v) return null;
  switch (key) {
    case "phone":
      return isValidPhone(v) ? null : "Celular com DDD, ex.: (11) 99999-9999";
    case "cpfCnpj":
      return isValidCPFOrCNPJ(v) ? null : "CPF ou CNPJ inválido";
    case "zipCode":
      return isValidCep(v) ? null : "CEP deve ter 8 dígitos";
    case "state":
      return isValidUf(v) ? null : "UF inválida";
    default:
      return null;
  }
}

/** Campos obrigatórios que estão vazios. */
export function missingProfileFields(p: ProfileFields | null | undefined): ProfileField[] {
  return REQUIRED_PROFILE_FIELDS.filter(({ key }) => !String(p?.[key] ?? "").trim()).map(({ key }) => key);
}

/** Perfil pronto para comprar: tudo preenchido e com formato válido. */
export function isProfileComplete(p: ProfileFields | null | undefined) {
  if (missingProfileFields(p).length > 0) return false;
  return REQUIRED_PROFILE_FIELDS.every(({ key }) => !fieldFormatError(key, p?.[key] as string));
}

/** Valida um conjunto de campos: obrigatórios vazios + formato. Retorna { campo: mensagem }. */
export function validateProfileFields(p: ProfileFields, keys: ProfileField[] = REQUIRED_PROFILE_FIELDS.map((f) => f.key)) {
  const errors: Partial<Record<ProfileField, string>> = {};
  for (const key of keys) {
    const v = String(p[key] ?? "").trim();
    if (!v) {
      errors[key] = "Campo obrigatório";
      continue;
    }
    const e = fieldFormatError(key, v);
    if (e) errors[key] = e;
  }
  return errors;
}

/** Força da senha: 0 (muito fraca) a 4 (forte). */
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  else if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 0.5;
  const s = Math.min(4, Math.floor(score)) as 0 | 1 | 2 | 3 | 4;
  const labels = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];
  return { score: pw ? s : 0, label: pw ? labels[s] : "" };
}

export const MIN_PASSWORD = 8;

/** Só aceita caminhos internos em ?redirect= (evita redirecionar para outro site). */
export function safeRedirect(v: string | null | undefined, fallback = "/conta") {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  return v;
}

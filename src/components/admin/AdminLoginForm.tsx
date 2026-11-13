"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowRight, ExternalLink, Eye, EyeOff, Loader2, Lock, Mail, Store, AlertCircle } from "lucide-react";

interface Props {
  storeName: string;
  logo: string | null;
  description: string | null;
  /** Primeira imagem do banner da loja, usada de fundo no painel da marca */
  heroImage: string | null;
}

const REMEMBER_KEY = "admin-login-email";

function BrandLogo({ logo, storeName }: { logo: string | null; storeName: string }) {
  return logo ? (
    <img src={logo} alt={storeName} className="h-20 w-auto object-contain rounded-2xl bg-white p-2 shadow-sm" />
  ) : (
    <span className="w-16 h-16 rounded-2xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center">
      <Store size={28} />
    </span>
  );
}

export default function AdminLoginForm({ storeName, logo, description, heroImage }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [shake, setShake] = useState(0);

  // Preenche o e-mail lembrado neste navegador
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do localStorage após a hidratação
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(result.error === "CredentialsSignin" ? "E-mail ou senha incorretos." : `Erro: ${result.error}`);
        setShake((n) => n + 1);
        return;
      }
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {}
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.");
      setShake((n) => n + 1);
    } finally {
      setLoading(false);
    }
  };

  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.("CapsLock") ?? false);
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-white">
      {/* Painel da marca (desktop) */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white" style={{ background: "linear-gradient(140deg, var(--brand), color-mix(in srgb, var(--brand) 45%, #0b0b14))" }}>
        {heroImage && (
          <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-luminosity" />
        )}
        <span className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-2xl animate-glow-drift" />
        <span className="absolute -bottom-32 -left-16 w-[28rem] h-[28rem] rounded-full blur-3xl animate-glow-drift [animation-delay:-7s]" style={{ background: "color-mix(in srgb, var(--brand) 60%, white)" , opacity: 0.25 }} />

        <div className="relative animate-fade-up">
          <BrandLogo logo={logo} storeName={storeName} />
        </div>

        <div className="relative max-w-md animate-fade-up [animation-delay:120ms]">
          <p className="text-sm font-medium text-white/70 uppercase tracking-widest">Painel administrativo</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight leading-tight">{storeName}</h1>
          {description && <p className="mt-4 text-white/80 leading-relaxed line-clamp-3">{description}</p>}
          <ul className="mt-8 space-y-2.5 text-sm text-white/85">
            {["Pedidos, etiquetas e Bling em um só lugar", "Indicadores de vendas, lucro e perdas", "Catálogo, cupons e promoções relâmpago"].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© {year} {storeName}</p>
      </aside>

      {/* Formulário */}
      <main className="relative flex items-center justify-center p-6 sm:p-10" style={{ background: "radial-gradient(ellipse at top, color-mix(in srgb, var(--brand) 8%, white), white 60%)" }}>
        <div className="w-full max-w-sm">
          {/* Marca no celular */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8 animate-fade-up">
            {logo ? (
              <img src={logo} alt={storeName} className="h-16 w-auto object-contain" />
            ) : (
              <span className="w-14 h-14 rounded-2xl bg-brand text-white flex items-center justify-center shadow-lg"><Store size={24} /></span>
            )}
            <p className="mt-3 text-lg font-semibold text-gray-900">{storeName}</p>
          </div>

          <div className="animate-fade-up [animation-delay:80ms]">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Que bom te ver de novo 👋</h2>
            <p className="text-sm text-gray-500 mt-1">Entre para gerenciar a sua loja.</p>
          </div>

          <form
            key={shake}
            onSubmit={handleSubmit}
            className={`mt-8 space-y-4 ${shake > 0 ? "animate-[login-shake_0.4s_ease-in-out]" : ""}`}
            noValidate={false}
          >
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  autoFocus={!email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm bg-white transition"
                  placeholder="voce@sualoja.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  autoFocus={!!email}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={checkCaps}
                  onKeyDown={checkCaps}
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-11 py-3 text-sm bg-white transition"
                  placeholder="Sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {capsLock && <p className="mt-1.5 text-xs text-amber-700">Caps Lock está ligado.</p>}
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600 select-none cursor-pointer">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded accent-[var(--brand)]" />
              Lembrar meu e-mail neste computador
            </label>

            {error && (
              <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 ring-1 ring-red-100 px-3 py-2.5 rounded-xl" role="alert">
                <AlertCircle size={16} className="shrink-0" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group w-full inline-flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-xl font-semibold shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--brand)_70%,transparent)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? "Entrando…" : "Entrar no painel"}
              {!loading && <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />}
            </button>
          </form>

          <div className="mt-10 flex items-center justify-between text-xs text-gray-400">
            <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-gray-700">
              <ExternalLink size={12} /> Ver a loja
            </a>
            <span>Acesso restrito à equipe da loja</span>
          </div>
        </div>
      </main>
    </div>
  );
}

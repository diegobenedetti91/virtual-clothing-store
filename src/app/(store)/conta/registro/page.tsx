"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomer } from "@/hooks/useCustomer";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useCustomer();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    phone: "",
    cpfCnpj: "",
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validações
    if (!formData.name.trim()) {
      setError("Nome completo é obrigatório");
      return;
    }
    if (!formData.email.trim()) {
      setError("E-mail é obrigatório");
      return;
    }
    if (!formData.phone.trim()) {
      setError("Telefone/WhatsApp é obrigatório");
      return;
    }
    if (!formData.cpfCnpj.trim()) {
      setError("CPF/CNPJ é obrigatório");
      return;
    }
    if (!formData.street.trim()) {
      setError("Rua/Avenida é obrigatória");
      return;
    }
    if (!formData.number.trim()) {
      setError("Número é obrigatório");
      return;
    }
    if (!formData.neighborhood.trim()) {
      setError("Bairro é obrigatório");
      return;
    }
    if (!formData.city.trim()) {
      setError("Cidade é obrigatória");
      return;
    }
    if (!formData.state.trim()) {
      setError("Estado é obrigatório");
      return;
    }
    if (!formData.zipCode.trim()) {
      setError("CEP é obrigatório");
      return;
    }
    if (formData.password !== formData.confirm) {
      setError("As senhas não coincidem");
      return;
    }
    if (formData.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar conta");
        return;
      }
      login(data);
      const redirect = searchParams.get("redirect");
      router.push(redirect || "/conta");
    } catch {
      setError("Erro ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="w-full max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2">Criar conta</h1>
          <p className="text-gray-500 text-sm">Preencha seus dados para começar a comprar</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Seção: Informações Pessoais */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações Pessoais</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Seu nome completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail *</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="seu@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone / WhatsApp *</label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">CPF / CNPJ *</label>
                  <input
                    type="text"
                    name="cpfCnpj"
                    required
                    value={formData.cpfCnpj}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  />
                </div>
              </div>
            </div>

            {/* Seção: Endereço de Entrega */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Endereço de Entrega</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Rua / Avenida *</label>
                    <input
                      type="text"
                      name="street"
                      required
                      value={formData.street}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="Rua/Avenida"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Número *</label>
                    <input
                      type="text"
                      name="number"
                      required
                      value={formData.number}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="123"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bairro *</label>
                  <input
                    type="text"
                    name="neighborhood"
                    required
                    value={formData.neighborhood}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Bairro"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Cidade *</label>
                    <input
                      type="text"
                      name="city"
                      required
                      value={formData.city}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="Cidade"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado *</label>
                    <select name="state" required value={formData.state} onChange={handleChange} className={inputClass}>
                      <option value="">Selecione...</option>
                      <option value="SP">SP - São Paulo</option>
                      <option value="RJ">RJ - Rio de Janeiro</option>
                      <option value="MG">MG - Minas Gerais</option>
                      <option value="BA">BA - Bahia</option>
                      <option value="SC">SC - Santa Catarina</option>
                      <option value="RS">RS - Rio Grande do Sul</option>
                      <option value="PR">PR - Paraná</option>
                      <option value="PE">PE - Pernambuco</option>
                      <option value="CE">CE - Ceará</option>
                      <option value="PA">PA - Pará</option>
                      <option value="GO">GO - Goiás</option>
                      <option value="PB">PB - Paraíba</option>
                      <option value="MA">MA - Maranhão</option>
                      <option value="ES">ES - Espírito Santo</option>
                      <option value="PI">PI - Piauí</option>
                      <option value="RN">RN - Rio Grande do Norte</option>
                      <option value="AL">AL - Alagoas</option>
                      <option value="MT">MT - Mato Grosso</option>
                      <option value="MS">MS - Mato Grosso do Sul</option>
                      <option value="DF">DF - Distrito Federal</option>
                      <option value="TO">TO - Tocantins</option>
                      <option value="RO">RO - Rondônia</option>
                      <option value="AM">AM - Amazonas</option>
                      <option value="RR">RR - Roraima</option>
                      <option value="AC">AC - Acre</option>
                      <option value="AP">AP - Amapá</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">CEP *</label>
                  <input
                    type="text"
                    name="zipCode"
                    required
                    value={formData.zipCode}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="00000-000"
                  />
                </div>
              </div>
            </div>

            {/* Seção: Segurança */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Segurança</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha *</label>
                  <input
                    type="password"
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar senha *</label>
                  <input
                    type="password"
                    name="confirm"
                    required
                    value={formData.confirm}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Repita a senha"
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? "Criando conta..." : "Criar conta"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Já tem conta?{" "}
            <Link
              href={searchParams.get("redirect") ? `/conta/login?redirect=${searchParams.get("redirect")}` : "/conta/login"}
              className="text-brand font-semibold hover:underline"
            >
              Entrar
            </Link>
          </p>
        </div>

        <p className="text-center mt-4">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Voltar à loja
          </Link>
        </p>
      </div>
    </div>
  );
}

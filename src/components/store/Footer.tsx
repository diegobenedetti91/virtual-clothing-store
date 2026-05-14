import Link from "next/link";
import { Phone, MapPin, MessageCircle } from "lucide-react";
import { CompanySettings } from "@/types";

interface FooterProps {
  settings?: CompanySettings | null;
}

export default function Footer({ settings }: FooterProps) {
  const name = settings?.name || "Minha Loja";
  const year = new Date().getFullYear();

  return (
    <footer className="bg-black text-gray-300 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white font-bold text-lg mb-3">{name}</h3>
            {settings?.description && (
              <p className="text-sm leading-relaxed">{settings.description}</p>
            )}
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3">Links Rápidos</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="hover:text-brand transition-colors">Início</Link></li>
              <li><Link href="/produtos" className="hover:text-brand transition-colors">Produtos</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3">Contato</h4>
            <ul className="space-y-2 text-sm">
              {settings?.whatsapp && (
                <li>
                  <a
                    href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-green-400 transition-colors"
                  >
                    <MessageCircle size={14} />
                    <span>WhatsApp</span>
                  </a>
                </li>
              )}
              {settings?.phone && (
                <li className="flex items-center gap-2">
                  <Phone size={14} />
                  <span>{settings.phone}</span>
                </li>
              )}
              {settings?.instagram && (
                <li>
                  <a
                    href={`https://instagram.com/${settings.instagram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-brand transition-colors"
                  >
                    <span className="text-sm">📷</span>
                    <span>{settings.instagram}</span>
                  </a>
                </li>
              )}
              {settings?.address && (
                <li className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  <span>{settings.address}</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-6 text-center text-xs text-gray-500">
          © {year} {name}. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}

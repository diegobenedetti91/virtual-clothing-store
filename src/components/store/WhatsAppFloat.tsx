"use client";

interface Props {
  whatsapp: string;
}

export default function WhatsAppFloat({ whatsapp }: Props) {
  const clean = whatsapp.replace(/\D/g, "");
  if (!clean) return null;

  return (
    <a
      href={`https://wa.me/${clean}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar pelo WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white pl-4 pr-5 py-3 rounded-full shadow-xl hover:shadow-2xl transition-all group"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-5 h-5 shrink-0"
      >
        <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.985-1.41A9.952 9.952 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.95 7.95 0 01-4.073-1.117l-.292-.173-3.007.851.84-2.944-.19-.305A7.96 7.96 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8zm4.406-5.92c-.242-.121-1.433-.707-1.655-.787-.222-.08-.383-.121-.544.121-.16.242-.624.787-.765.948-.14.16-.282.181-.524.06-.242-.12-1.022-.376-1.946-1.2-.72-.64-1.205-1.43-1.346-1.672-.14-.242-.015-.373.106-.494.108-.108.242-.282.363-.423.12-.14.16-.242.242-.403.08-.16.04-.302-.02-.423-.06-.12-.544-1.313-.745-1.797-.196-.472-.396-.408-.544-.416l-.463-.008c-.16 0-.423.06-.644.302-.222.242-.847.828-.847 2.02 0 1.19.867 2.341.987 2.503.12.16 1.706 2.607 4.134 3.654.578.25 1.029.398 1.38.51.58.184 1.108.158 1.525.096.465-.07 1.433-.586 1.635-1.152.2-.565.2-1.05.14-1.152-.06-.1-.222-.16-.464-.282z" />
      </svg>
      <span className="text-sm font-semibold">Falar conosco</span>
    </a>
  );
}

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Anima a entrada dos elementos marcados com `data-reveal` quando entram na tela.
 * Um único observer para a página toda; elementos que já estão visíveis ao
 * carregar são marcados na hora, sem animar (evita "piscar" o conteúdo).
 */
export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    const register = (el: Element) => {
      if (el.classList.contains("is-revealed")) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0 && !root.classList.contains("reveal-ready")) {
        el.classList.add("is-revealed"); // já visível no primeiro paint
        return;
      }
      io.observe(el);
    };

    document.querySelectorAll("[data-reveal]").forEach(register);
    root.classList.add("reveal-ready");

    // Conteúdo renderizado depois (filtros, carrosséis, navegação client-side)
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches("[data-reveal]")) register(node);
          node.querySelectorAll?.("[data-reveal]").forEach(register);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);

  return null;
}

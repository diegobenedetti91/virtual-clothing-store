/**
 * Avisos e confirmações do site (substituem alert/confirm do navegador).
 *
 *   notify.success("Produto salvo")
 *   notify.error("Não foi possível salvar", { description: "Tente de novo em instantes." })
 *   if (!(await confirmDialog({ title: "Excluir produto?", message: "...", confirmText: "Excluir", tone: "danger" }))) return;
 *
 * Funciona em qualquer componente cliente: o <Notifier /> montado no layout raiz exibe tudo.
 */

export type ToastTone = "success" | "error" | "warning" | "info";

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  duration: number;
}

export interface ConfirmRequest {
  id: number;
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  tone: "default" | "danger";
  resolve: (ok: boolean) => void;
}

interface State {
  toasts: Toast[];
  confirm: ConfirmRequest | null;
}

let state: State = { toasts: [], confirm: null };
const listeners = new Set<() => void>();
let nextId = 1;
const confirmQueue: ConfirmRequest[] = [];

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const getState = () => state;
const EMPTY: State = { toasts: [], confirm: null };
export const getServerState = () => EMPTY;

export function dismissToast(id: number) {
  set({ toasts: state.toasts.filter((t) => t.id !== id) });
}

function push(tone: ToastTone, title: string, opts: { description?: string; duration?: number } = {}) {
  const clean = title.replace(/^Error:\s*/, "").trim() || (tone === "error" ? "Algo deu errado" : "Pronto");
  // Mesma mensagem já na tela: não empilha repetida
  const dup = state.toasts.find((t) => t.title === clean && t.description === opts.description);
  if (dup) dismissToast(dup.id);
  const toast: Toast = {
    id: nextId++,
    tone,
    title: clean,
    description: opts.description,
    // Erros ficam mais tempo para dar tempo de ler
    duration: opts.duration ?? (tone === "error" || tone === "warning" ? 7000 : 4000),
  };
  set({ toasts: [...state.toasts, toast].slice(-4) });
  return toast.id;
}

export const notify = {
  success: (title: string, opts?: { description?: string; duration?: number }) => push("success", title, opts),
  error: (title: string, opts?: { description?: string; duration?: number }) => push("error", title, opts),
  warning: (title: string, opts?: { description?: string; duration?: number }) => push("warning", title, opts),
  info: (title: string, opts?: { description?: string; duration?: number }) => push("info", title, opts),
};

function showNextConfirm() {
  if (state.confirm || confirmQueue.length === 0) return;
  set({ confirm: confirmQueue.shift()! });
}

/** Pergunta de confirmação. Resolve true (confirmou) ou false (cancelou / Esc / clicou fora). */
export function confirmDialog(opts: { title: string; message?: string; confirmText?: string; cancelText?: string; tone?: "default" | "danger" }): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    confirmQueue.push({
      id: nextId++,
      title: opts.title,
      message: opts.message,
      confirmText: opts.confirmText || "Confirmar",
      cancelText: opts.cancelText || "Cancelar",
      tone: opts.tone || "default",
      resolve,
    });
    showNextConfirm();
  });
}

export function answerConfirm(ok: boolean) {
  const c = state.confirm;
  if (!c) return;
  set({ confirm: null });
  c.resolve(ok);
  showNextConfirm();
}

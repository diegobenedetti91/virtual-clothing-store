"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Copy, Check, Loader2, AlertCircle, QrCode } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// Mercado Pago Payment Brick: card (credit/debit) and Pix form rendered inside
// the store. Card data goes from the browser straight to Mercado Pago (we only
// receive a token); the payment is created by /api/checkout/mercadopago/transparent.

const SDK_URL = "https://sdk.mercadopago.com/js/v2";
const CONTAINER_ID = "mp-payment-brick";
const PIX_POLL_MS = 5000;

interface BrickController {
  unmount: () => void;
}
interface MercadoPagoInstance {
  bricks: () => { create: (type: string, container: string, settings: unknown) => Promise<BrickController> };
}
declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;
  }
}

let sdkPromise: Promise<void> | null = null;
function loadSdk(): Promise<void> {
  if (typeof window !== "undefined" && window.MercadoPago) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        sdkPromise = null;
        reject(new Error("Falha ao carregar o Mercado Pago"));
      };
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

interface PixData {
  qrCode: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  expiresAt?: string | null;
  amount: number;
}

interface PaymentResponse {
  status: "approved" | "in_process" | "pix" | "rejected" | "error";
  orderNumber?: string;
  message?: string;
  pix?: PixData;
}

interface Props {
  publicKey: string;
  amount: number;
  payerEmail?: string;
  pixOnly: boolean;
  /** Checkout fields (customer, address, items, shipping) sent with the payment */
  buildPayload: () => Record<string, unknown>;
  /** Called once an order exists (paid, under review or Pix generated): clear the cart */
  onOrderCreated: () => void;
  onClose: () => void;
}

export default function MercadoPagoTransparentCheckout({ publicKey, amount, payerEmail, pixOnly, buildPayload, onOrderCreated, onClose }: Props) {
  const router = useRouter();
  const [loadingBrick, setLoadingBrick] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pix, setPix] = useState<{ orderNumber: string; data: PixData } | null>(null);
  const [brickKey, setBrickKey] = useState(0);
  const controllerRef = useRef<BrickController | null>(null);
  // Callbacks kept in refs so a re-render of the checkout page never re-creates the Brick
  const payloadRef = useRef(buildPayload);
  const orderCreatedRef = useRef(onOrderCreated);
  useEffect(() => {
    payloadRef.current = buildPayload;
    orderCreatedRef.current = onOrderCreated;
  });

  // ---- Payment Brick
  useEffect(() => {
    if (pix) return;
    let cancelled = false;

    (async () => {
      try {
        await loadSdk();
        if (cancelled || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        const controller = await mp.bricks().create("payment", CONTAINER_ID, {
          initialization: { amount, ...(payerEmail ? { payer: { email: payerEmail } } : {}) },
          customization: {
            paymentMethods: pixOnly
              ? { bankTransfer: "all" }
              : { creditCard: "all", debitCard: "all", bankTransfer: "all", maxInstallments: 12 },
            visual: { style: { theme: "default" } },
          },
          callbacks: {
            onReady: () => setLoadingBrick(false),
            onError: (err: unknown) => console.error("[MP Brick]", err),
            onSubmit: ({ formData }: { formData: Record<string, unknown> }) =>
              new Promise<void>((resolve, reject) => {
                setError(null);
                fetch("/api/checkout/mercadopago/transparent", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...payloadRef.current(), formData }),
                })
                  .then(async (res) => (await res.json().catch(() => ({ status: "error" }))) as PaymentResponse)
                  .then((data) => {
                    if ((data.status === "approved" || data.status === "in_process") && data.orderNumber) {
                      resolve();
                      orderCreatedRef.current();
                      router.push(
                        data.status === "approved"
                          ? `/checkout/sucesso?order=${data.orderNumber}`
                          : `/checkout/pendente?order=${data.orderNumber}`
                      );
                    } else if (data.status === "pix" && data.orderNumber && data.pix) {
                      resolve();
                      orderCreatedRef.current();
                      setPix({ orderNumber: data.orderNumber, data: data.pix });
                    } else {
                      setError(data.message || "Não foi possível concluir o pagamento. Tente novamente.");
                      reject();
                      // Fresh form for a new attempt (another card, or Pix)
                      setLoadingBrick(true);
                      setBrickKey((k) => k + 1);
                    }
                  })
                  .catch(() => {
                    setError("Falha de conexão. Verifique sua internet e tente novamente.");
                    reject();
                  });
              }),
          },
        });
        if (cancelled) controller.unmount();
        else controllerRef.current = controller;
      } catch (err) {
        console.error("[MP Brick] init failed", err);
        if (!cancelled) {
          setError("Não foi possível carregar o pagamento. Recarregue a página e tente novamente.");
          setLoadingBrick(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controllerRef.current?.unmount();
      controllerRef.current = null;
    };
  }, [publicKey, amount, payerEmail, pixOnly, brickKey, pix, router]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white w-full sm:max-w-lg max-h-[95vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <p className="font-bold text-gray-900">{pix ? "Pague com Pix" : "Pagamento"}</p>
            <p className="text-xs text-gray-500">Total: {formatCurrency(pix ? pix.data.amount : amount)}</p>
          </div>
          <button
            type="button"
            onClick={() => (pix ? router.push(`/checkout/pendente?order=${pix.orderNumber}`) : onClose())}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {pix ? (
            <PixPanel orderNumber={pix.orderNumber} data={pix.data} />
          ) : (
            <>
              {error && (
                <div className="mb-4 flex gap-2 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {loadingBrick && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
                  <Loader2 size={16} className="animate-spin" /> Carregando formas de pagamento...
                </div>
              )}
              <div id={CONTAINER_ID} key={brickKey} />
              <p className="mt-3 text-[11px] text-gray-400 text-center">
                Pagamento processado pelo Mercado Pago. Os dados do cartão não passam pelos servidores da loja.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PixPanel({ orderNumber, data }: { orderNumber: string; data: PixData }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<"waiting" | "expired">("waiting");

  // Wait for the webhook to confirm the payment, then go to the success page
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/orders/by-number/${encodeURIComponent(orderNumber)}`, { cache: "no-store" });
        if (!res.ok) return;
        const order = (await res.json()) as { status?: string };
        if (stopped) return;
        if (order.status === "CANCELLED") setState("expired");
        else if (order.status && order.status !== "PENDING") router.push(`/checkout/sucesso?order=${orderNumber}`);
      } catch {}
    };
    const timer = setInterval(check, PIX_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [orderNumber, router]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  if (state === "expired") {
    return (
      <div className="text-center py-6">
        <AlertCircle size={36} className="mx-auto text-amber-500 mb-3" />
        <p className="font-semibold text-gray-900">O Pix expirou</p>
        <p className="text-sm text-gray-500 mt-1">Este código não pode mais ser pago. Faça o pedido novamente.</p>
      </div>
    );
  }

  const expires = data.expiresAt ? new Date(data.expiresAt) : null;

  return (
    <div className="text-center">
      <p className="text-sm text-gray-600 mb-4">
        Pedido <span className="font-semibold">{orderNumber}</span>. Abra o app do seu banco e pague com o QR Code ou o código copia e cola.
      </p>
      {data.qrCodeBase64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`data:image/png;base64,${data.qrCodeBase64}`} alt="QR Code Pix" className="mx-auto w-56 h-56" />
      ) : (
        <QrCode size={64} className="mx-auto text-gray-300" />
      )}
      <div className="mt-4 text-left">
        <label className="text-xs font-medium text-gray-500">Pix copia e cola</label>
        <div className="mt-1 flex gap-2">
          <input readOnly value={data.qrCode} className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 bg-gray-50" />
          <button
            type="button"
            onClick={copy}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand text-white text-xs font-bold hover:opacity-90"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-center gap-2 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" /> Aguardando pagamento... a confirmação é automática.
      </div>
      {expires && (
        <p className="mt-2 text-xs text-gray-400">
          Válido até {expires.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
        </p>
      )}
    </div>
  );
}

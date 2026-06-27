import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const formatBRL = (value: number | string | null | undefined) => {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return BRL.format(Number.isFinite(n) ? (n as number) : 0);
};

export const formatNumber = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR").format(
    typeof value === "string" ? Number(value) : value ?? 0,
  );

export const formatPercent = (value: number) =>
  `${(value * 100).toFixed(1).replace(".", ",")}%`;

export const formatDateBR = (value: string | Date | null | undefined) => {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  return format(d, "dd/MM/yyyy", { locale: ptBR });
};

export const formatMonthLabel = (refMonth: string) => {
  // refMonth: YYYY-MM
  const [y, m] = refMonth.split("-").map(Number);
  return format(new Date(y, (m ?? 1) - 1, 1), "MMM/yy", { locale: ptBR });
};

export const formatMonthLong = (refMonth: string) => {
  const [y, m] = refMonth.split("-").map(Number);
  return format(new Date(y, (m ?? 1) - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
};

export const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const currentMonthKey = () => monthKey(new Date());

export const addMonths = (refMonth: string, delta: number) => {
  const [y, m] = refMonth.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1 + delta, 1);
  return monthKey(d);
};

export const paymentMethodLabel = (m: string) => {
  const map: Record<string, string> = {
    pix: "PIX",
    credit_card: "Cartão de Crédito",
    debit_card: "Cartão de Débito",
    bank_slip: "Boleto",
    cash: "Dinheiro",
    transfer: "Transferência",
  };
  return map[m] ?? m;
};

export const billingCycleLabel = (c: string) => {
  const map: Record<string, string> = {
    monthly: "Mensal",
    quarterly: "Trimestral",
    semiannual: "Semestral",
    annual: "Anual",
  };
  return map[c] ?? c;
};

export const statusLabel = {
  payment: {
    paid: "Pago",
    pending: "Pendente",
    overdue: "Atrasado",
    cancelled: "Cancelado",
  } as Record<string, string>,
  student: {
    active: "Ativo",
    inactive: "Inativo",
    churned: "Desligado",
  } as Record<string, string>,
};

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

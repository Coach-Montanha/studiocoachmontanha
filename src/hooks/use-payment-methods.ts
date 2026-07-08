import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { paymentMethodLabel } from "@/lib/format";

export type PaymentMethod = {
  id: string;
  key: string;
  label: string;
  is_active: boolean;
  sort_order: number;
};

export const DEFAULT_PAYMENT_METHODS: Array<{ key: string; label: string }> = [
  { key: "pix", label: "PIX" },
  { key: "credit_card", label: "Cartão de Crédito" },
  { key: "debit_card", label: "Cartão de Débito" },
  { key: "bank_slip", label: "Boleto" },
  { key: "cash", label: "Dinheiro" },
  { key: "transfer", label: "Transferência" },
];

export function usePaymentMethods(opts: { activeOnly?: boolean } = {}) {
  const query = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("id,key,label,is_active,sort_order")
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PaymentMethod[];
    },
    staleTime: 60_000,
  });

  const methods = query.data ?? [];
  const filtered = opts.activeOnly ? methods.filter((m) => m.is_active) : methods;

  const labelMap = new Map<string, string>();
  for (const m of methods) labelMap.set(m.key, m.label);

  return {
    ...query,
    methods: filtered,
    all: methods,
    labelFor: (key: string | null | undefined) =>
      key ? labelMap.get(key) ?? paymentMethodLabel(key) : "—",
  };
}

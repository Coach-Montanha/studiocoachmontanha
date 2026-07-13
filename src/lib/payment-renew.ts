import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

type MinimalPayment = {
  id: string;
  student_id: string;
  plan_id: string | null;
  amount: number;
  payment_date: string;
  reference_month: string;
  payment_method: string;
  notes: string | null;
  renewals_remaining?: number | null;
  plans?: { billing_cycle?: string | null; max_renewals?: number | null } | null;
};

function bumpMonths(referenceMonth: string, months: number) {
  const [y, m] = referenceMonth.split("-").map(Number);
  const d = new Date(y, (m - 1) + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function cycleMonths(cycle?: string | null) {
  switch (cycle) {
    case "quarterly": return 3;
    case "semiannual":
    case "semi_annual":
    case "biannual": return 6;
    case "annual":
    case "yearly": return 12;
    case "monthly":
    default: return 1;
  }
}

function bumpDueDate(paymentDate: string, cycle?: string | null) {
  const d = new Date(paymentDate + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + cycleMonths(cycle));
  return format(d, "yyyy-MM-dd");
}

/** Duplicate a payment for the next billing cycle. Returns true on success. */
export async function renewPayment(payment: MinimalPayment): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    toast.error("Sessão expirada");
    return false;
  }

  // Fetch billing_cycle / max_renewals from plan if not provided
  let cycle: string | null | undefined = payment.plans?.billing_cycle;
  let planMax: number | null | undefined = payment.plans?.max_renewals;
  if ((cycle === undefined || planMax === undefined) && payment.plan_id) {
    const { data } = await supabase
      .from("plans")
      .select("billing_cycle,max_renewals")
      .eq("id", payment.plan_id)
      .maybeSingle();
    if (cycle === undefined) cycle = data?.billing_cycle;
    if (planMax === undefined) planMax = data?.max_renewals;
  }

  // Compute renewals_remaining chain
  let remaining: number | null = null;
  if (payment.renewals_remaining != null) {
    remaining = payment.renewals_remaining;
  } else if (planMax != null) {
    // First renewal of a payment created before tracking; assume plan's max
    remaining = planMax;
  }
  if (remaining != null && remaining <= 0) {
    toast.error("Limite de renovações automáticas atingido para este pagamento");
    return false;
  }
  const nextRemaining = remaining != null ? remaining - 1 : null;

  const months = cycleMonths(cycle);
  const nextRef = bumpMonths(payment.reference_month, months);
  const today = format(new Date(), "yyyy-MM-dd");

  const insertPayload: any = {
    user_id: userId,
    student_id: payment.student_id,
    plan_id: payment.plan_id,
    amount: Number(payment.amount),
    payment_date: today,
    due_date: bumpDueDate(today, cycle),
    reference_month: nextRef,
    payment_method: payment.payment_method,
    status: "paid",
    notes: payment.notes,
    renewed_from_payment_id: payment.id,
    auto_renew: nextRemaining == null || nextRemaining > 0,
    renewals_remaining: nextRemaining,
  };

  const { error } = await supabase.from("payments").insert(insertPayload).select("id");
  if (error) {
    toast.error(error.message);
    return false;
  }
  const msg = nextRemaining != null
    ? `Pagamento renovado para ${nextRef} (${nextRemaining} renovação(ões) restante(s))`
    : `Pagamento renovado para ${nextRef}`;
  toast.success(msg);
  return true;
}

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
  plans?: { billing_cycle?: string | null } | null;
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

  // Fetch billing_cycle from plan if not provided
  let cycle: string | null | undefined = payment.plans?.billing_cycle;
  if (!cycle && payment.plan_id) {
    const { data } = await supabase.from("plans").select("billing_cycle").eq("id", payment.plan_id).maybeSingle();
    cycle = data?.billing_cycle;
  }

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
  };

  const { error } = await supabase.from("payments").insert(insertPayload).select("id");
  if (error) {
    toast.error(error.message);
    return false;
  }
  toast.success(`Pagamento renovado para ${nextRef}`);
  return true;
}

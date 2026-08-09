export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function combineDateTime(dateISO: string, timeHHMM: string): Date {
  // Interpret naive session date/time as America/Sao_Paulo (UTC-3, no DST).
  // Server functions run on Cloudflare Workers in UTC, so without an explicit
  // offset the check-in window would be shifted by ~3h and reject valid attempts.
  return new Date(`${dateISO}T${timeHHMM.slice(0, 5)}:00-03:00`);
}

function weekBounds(d: Date, weekStartsOn: number = 1): { start: Date; end: Date } {
  const day = d.getDay();
  // weekStartsOn: 0 for Sunday, 1 for Monday
  const diff = (day - weekStartsOn + 7) % 7;
  
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function monthBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export type QuotaUsage = {
  plan_id: string | null;
  plan_name: string | null;
  quota_type: "none" | "weekly" | "monthly" | "package";
  quota_amount: number | null;
  used: number;
  remaining: number | null;
  period_label: string;
  package_expires_at: string | null;
};

export async function computeQuotaUsage(
  supabase: any,
  studentId: string,
): Promise<QuotaUsage> {
  const today = toDateKey(new Date());
  
  // Fetch both payments and settings to get the week start day
  const [{ data: currentPayments }, { data: settings }] = await Promise.all([
    supabase
      .from("payments")
      .select("plan_id, student_id, user_id, payment_date, due_date, plans:plan_id ( name, checkin_quota_type, checkin_quota_amount, package_valid_days )")
      .eq("student_id", studentId)
      .eq("status", "paid")
      .not("plan_id", "is", null)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("studio_settings")
      .select("checkin_week_start_day")
      .limit(1)
      .maybeSingle()
  ]);
  
  const weekStartsOn = settings?.checkin_week_start_day ?? 0;
  const current = (currentPayments ?? []).find((p: any) => !p.due_date || p.due_date >= today);

  const plan = current?.plans;
  const quotaType = (plan?.checkin_quota_type ?? "none") as QuotaUsage["quota_type"];
  const quotaAmount = plan?.checkin_quota_amount ?? null;
  const now = new Date();

  const base: QuotaUsage = {
    plan_id: current?.plan_id ?? null,
    plan_name: plan?.name ?? null,
    quota_type: quotaType,
    quota_amount: quotaAmount,
    used: 0,
    remaining: quotaAmount,
    period_label: "",
    package_expires_at: null,
  };

  if (quotaType === "none" || !quotaAmount) return base;

  let periodStart: Date;
  let periodEnd: Date;
  let periodLabel: string;
  let packageExpiresAt: string | null = null;

  if (quotaType === "weekly") {
    const wb = weekBounds(now, weekStartsOn);
    periodStart = wb.start;
    periodEnd = wb.end;
    periodLabel = "esta semana";
  } else if (quotaType === "monthly") {
    const mb = monthBounds(now);
    periodStart = mb.start;
    periodEnd = mb.end;
    periodLabel = "este mês";
  } else {
    const start = current?.payment_date ? new Date(current.payment_date) : now;
    const validDays = plan?.package_valid_days ?? 30;
    periodStart = new Date(start);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + validDays);
    packageExpiresAt = periodEnd.toISOString().slice(0, 10);
    periodLabel = `até ${new Date(periodEnd).toLocaleDateString("pt-BR")}`;
  }

  const { data: attRows } = await supabase
    .from("class_attendance")
    .select("id, class_sessions:session_id ( session_date )")
    .eq("student_id", studentId);

  const used = (attRows ?? []).filter((r: any) => {
    const sd = r.class_sessions?.session_date;
    if (!sd) return false;
    const d = new Date(`${sd}T12:00:00`);
    return d >= periodStart && d <= periodEnd;
  }).length;

  return {
    ...base,
    used,
    remaining: Math.max(0, quotaAmount - used),
    period_label: periodLabel,
    package_expires_at: packageExpiresAt,
  };
}

export async function loadSessionContext(supabase: any, sessionId: string) {
  const { data: session, error } = await supabase
    .from("class_sessions")
    .select(`
      id, session_date, start_time, class_id, user_id,
      classes:class_id (
        capacity, program_id,
        checkin_opens_minutes_before, checkin_closes_minutes_before
      )
    `)
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session) throw new Error("Sessão não encontrada");
  return session;
}
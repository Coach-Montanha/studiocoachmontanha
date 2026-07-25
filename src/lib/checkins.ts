/**
 * Alocação FIFO de check-ins entre pagamentos de planos do tipo "pacote".
 * Compartilhado entre o perfil do aluno e a lista de alunos.
 */

export type CheckinPkg = {
  quota: number;
  isOverride: boolean;
  used: string[];
  validUntil: string | null;
  freezeDays: number;
};

export type CheckinPaymentLike = {
  id: string;
  status: string;
  payment_date: string;
  checkin_quota_override?: number | null;
  plans?: {
    checkin_quota_type?: string | null;
    checkin_quota_amount?: number | null;
    package_valid_days?: number | null;
  } | null;
};

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Distribui os check-ins (FIFO) entre os pagamentos de planos do tipo pacote. */
export function allocateCheckins(
  payments: CheckinPaymentLike[],
  attendanceDates: string[],
  freezes: { payment_id?: string | null; freeze_days?: number | null }[] = [],
): Map<string, CheckinPkg> {
  const result = new Map<string, CheckinPkg>();

  const packages = payments
    .filter((p) => p.status === "paid" && p.plans?.checkin_quota_type === "package")
    .sort((a, b) => (a.payment_date < b.payment_date ? -1 : 1))
    .map((p) => {
      const freezeDays = (freezes ?? [])
        .filter((f) => f.payment_id === p.id)
        .reduce((s, f) => s + Number(f.freeze_days ?? 0), 0);
      const quota = p.checkin_quota_override ?? p.plans?.checkin_quota_amount ?? 0;
      const validDays = p.plans?.package_valid_days ?? null;
      return {
        id: p.id,
        start: p.payment_date.slice(0, 10),
        validUntil: validDays != null ? addDays(p.payment_date.slice(0, 10), validDays + freezeDays) : null,
        quota,
        isOverride: p.checkin_quota_override != null,
        freezeDays,
        used: [] as string[],
      };
    });

  if (!packages.length) return result;

  const dates = [...attendanceDates].map((d) => d.slice(0, 10)).sort();
  for (const date of dates) {
    const target = packages.find(
      (pk) => pk.used.length < pk.quota && date >= pk.start && (!pk.validUntil || date <= pk.validUntil),
    );
    if (target) target.used.push(date);
  }

  for (const pk of packages) {
    result.set(pk.id, {
      quota: pk.quota,
      isOverride: pk.isOverride,
      used: pk.used,
      validUntil: pk.validUntil,
      freezeDays: pk.freezeDays,
    });
  }
  return result;
}

export type CheckinTone = "primary" | "warning" | "destructive";

export function checkinTone(remaining: number, quota: number): CheckinTone {
  if (remaining <= 0) return "destructive";
  if (remaining <= Math.max(1, Math.ceil(quota * 0.2))) return "warning";
  return "primary";
}

/** Classe do chip compacto de check-ins, por estado semântico. */
export function checkinChipClass(tone: CheckinTone) {
  return tone === "destructive"
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : tone === "warning"
      ? "border-warning/40 bg-warning/15 text-foreground"
      : "border-primary/25 bg-primary/10 text-primary";
}

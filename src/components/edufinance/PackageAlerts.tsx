import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { CalendarClock, TicketX, ArrowRight, Send, Loader2, BellRing } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useScopeFilter } from "@/hooks/use-scope-filter";
import { allocateCheckins } from "@/lib/checkins";
import { sendInAppNotification } from "@/lib/notifications.functions";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Limiares dos alertas — ajuste aqui se a régua do studio mudar. */
const EXPIRING_IN_DAYS = 7;
const LOW_CHECKINS = 2;

type PkgPayment = {
  id: string;
  status: string;
  payment_date: string;
  checkin_quota_override: number | null;
  plans: {
    name?: string | null;
    checkin_quota_type?: string | null;
    checkin_quota_amount?: number | null;
    package_valid_days?: number | null;
  } | null;
};

type StudentRow = {
  id: string;
  name: string;
  account_user_id: string | null;
  payments: PkgPayment[] | null;
};

type AlertRow = {
  studentId: string;
  name: string;
  plan: string | null;
  remaining: number;
  quota: number;
  validUntil: string | null;
  daysLeft: number | null;
  hasAccount: boolean;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO: string) {
  const a = new Date(`${fromISO}T00:00:00`).getTime();
  const b = new Date(`${toISO}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

const tiles = {
  expiring: {
    tone: "border-state-pending/25 bg-state-pending-soft text-state-pending hover:border-state-pending/50",
    capsule: "bg-state-pending-soft text-state-pending ring-state-pending/20",
    icon: CalendarClock,
    label: "Pacotes vencendo",
    hint: `validade em até ${EXPIRING_IN_DAYS} dias`,
    title: "Pacotes vencendo em breve",
    empty: "Nenhum pacote perto do vencimento",
  },
  low: {
    tone: "border-state-late/25 bg-state-late-soft text-state-late hover:border-state-late/50",
    capsule: "bg-state-late-soft text-state-late ring-state-late/20",
    icon: TicketX,
    label: "Check-ins acabando",
    hint: `${LOW_CHECKINS} ou menos restantes`,
    title: "Check-ins acabando",
    empty: "Todos os pacotes com saldo confortável",
  },
} as const;

type TileKey = keyof typeof tiles;

function AlertTile({
  tone, icon: Icon, count, label, hint, onClick,
}: {
  tone: string;
  icon: LucideIcon;
  count: number;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count === 0}
      className={cn(
        "focus-ring group flex items-center gap-3 rounded-xl border p-3.5 text-left transition-ui",
        tone,
        count === 0
          ? "cursor-default opacity-45"
          : "hover:-translate-y-0.5 hover:shadow-card active:translate-y-0",
      )}
    >
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-card/70">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-numeric block text-xl leading-none">{count}</span>
        <span className="text-caption mt-1 block truncate font-semibold">{label}</span>
        <span className="text-caption block truncate opacity-70">{hint}</span>
      </span>
      {count > 0 && (
        <ArrowRight
          aria-hidden
          className="h-4 w-4 shrink-0 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-70"
        />
      )}
    </button>
  );
}

/** Mensagem automática enviada ao aluno, por tipo de alerta. */
function buildMessage(view: TileKey, row: AlertRow) {
  if (view === "expiring") {
    const when =
      row.daysLeft === 0 ? "vence hoje" : row.daysLeft === 1 ? "vence amanhã" : `vence em ${row.daysLeft} dias`;
    return {
      title: "Seu pacote está vencendo",
      body:
        `Olá, ${row.name}! Seu pacote ${when}` +
        (row.validUntil ? ` (${formatDateBR(row.validUntil)})` : "") +
        (row.remaining > 0
          ? ` e você ainda tem ${row.remaining} check-in${row.remaining > 1 ? "s" : ""} para usar.`
          : ".") +
        " Aproveite para agendar ou renovar com o studio.",
    };
  }
  return {
    title: "Seus check-ins estão acabando",
    body:
      `Olá, ${row.name}! ` +
      (row.remaining <= 0
        ? "Seu pacote de check-ins acabou."
        : `Restam ${row.remaining} check-in${row.remaining > 1 ? "s" : ""} no seu pacote.`) +
      " Fale com o studio para renovar e não ficar sem treinar.",
  };
}

export function PackageAlerts() {
  const navigate = useNavigate();
  const { scopeId, scopeKey, ready } = useScopeFilter();
  const [view, setView] = useState<TileKey | null>(null);
  const [sending, setSending] = useState(false);
  const [notified, setNotified] = useState<Record<string, boolean>>({});
  const notify = useServerFn(sendInAppNotification);

  const { data: students = [] } = useQuery({
    queryKey: ["package-alert-students", scopeKey],
    enabled: ready,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      let q = supabase
        .from("students")
        .select(
          "id,name,account_user_id,payments(id,status,payment_date,checkin_quota_override,plans(name,checkin_quota_type,checkin_quota_amount,package_valid_days))",
        )
        .is("deleted_at", null)
        .eq("status", "active")
        .order("name");
      if (scopeId) q = q.eq("user_id", scopeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as StudentRow[];
    },
  });

  const packageStudentIds = useMemo(
    () =>
      students
        .filter((s) =>
          (s.payments ?? []).some(
            (p) => p.status === "paid" && p.plans?.checkin_quota_type === "package",
          ),
        )
        .map((s) => s.id),
    [students],
  );
  const idsKey = packageStudentIds.join(",");

  const { data: extra } = useQuery({
    queryKey: ["package-alert-usage", idsKey],
    enabled: packageStudentIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [att, frz] = await Promise.all([
        supabase
          .from("class_attendance")
          .select("student_id, class_sessions:session_id (session_date)")
          .in("student_id", packageStudentIds),
        supabase
          .from("payment_freezes")
          .select("student_id, payment_id, freeze_days")
          .in("student_id", packageStudentIds),
      ]);
      const dates: Record<string, string[]> = {};
      for (const r of (att.data ?? []) as any[]) {
        const d = r.class_sessions?.session_date;
        if (!d || !r.student_id) continue;
        (dates[r.student_id] ??= []).push(d);
      }
      const freezes: Record<string, { payment_id: string | null; freeze_days: number }[]> = {};
      for (const f of (frz.data ?? []) as any[]) {
        (freezes[f.student_id] ??= []).push({ payment_id: f.payment_id, freeze_days: f.freeze_days });
      }
      return { dates, freezes };
    },
  });

  const groups = useMemo(() => {
    const today = todayISO();
    const expiring: AlertRow[] = [];
    const low: AlertRow[] = [];

    for (const s of students) {
      const pays = (s.payments ?? []).filter(
        (p) => p.status === "paid" && p.plans?.checkin_quota_type === "package",
      );
      if (!pays.length) continue;
      const alloc = allocateCheckins(pays, extra?.dates[s.id] ?? [], extra?.freezes[s.id] ?? []);

      // Pacote ativo = ainda dentro da validade (ou sem validade definida).
      const active = pays
        .map((p) => ({ p, pkg: alloc.get(p.id) }))
        .filter((x) => x.pkg && (!x.pkg.validUntil || x.pkg.validUntil >= today))
        .sort((a, b) => (a.p.payment_date < b.p.payment_date ? -1 : 1));
      if (!active.length) continue;

      const remainingTotal = active.reduce(
        (acc, x) => acc + Math.max(0, x.pkg!.quota - x.pkg!.used.length),
        0,
      );
      const withValidity = active.filter((x) => x.pkg!.validUntil);
      const nearest = withValidity.length
        ? withValidity.reduce((a, b) => (a.pkg!.validUntil! <= b.pkg!.validUntil! ? a : b))
        : null;
      const validUntil = nearest?.pkg!.validUntil ?? null;
      const daysLeft = validUntil ? daysBetween(today, validUntil) : null;

      const base: AlertRow = {
        studentId: s.id,
        name: s.name,
        plan: active[active.length - 1].p.plans?.name ?? null,
        remaining: remainingTotal,
        quota: active.reduce((acc, x) => acc + x.pkg!.quota, 0),
        validUntil,
        daysLeft,
        hasAccount: Boolean(s.account_user_id),
      };

      if (daysLeft !== null && daysLeft >= 0 && daysLeft <= EXPIRING_IN_DAYS && remainingTotal > 0) {
        expiring.push(base);
      }
      if (remainingTotal <= LOW_CHECKINS) low.push(base);
    }

    expiring.sort((a, b) => (a.daysLeft ?? 99) - (b.daysLeft ?? 99));
    low.sort((a, b) => a.remaining - b.remaining);
    return { expiring, low };
  }, [students, extra]);

  const rows = view ? groups[view] : [];
  const cfg = view ? tiles[view] : null;
  const targets = rows.filter((r) => r.hasAccount);
  const any = groups.expiring.length > 0 || groups.low.length > 0;

  async function notifyAll() {
    if (!view || !targets.length) return;
    setSending(true);
    try {
      let sent = 0;
      for (const row of targets) {
        const msg = buildMessage(view, row);
        const res = await notify({ data: { studentIds: [row.studentId], ...msg } });
        sent += res?.sent ?? 0;
      }
      setNotified((n) => ({ ...n, [view]: true }));
      const skipped = rows.length - targets.length;
      toast.success(
        `${sent} aluno${sent === 1 ? "" : "s"} avisado${sent === 1 ? "" : "s"}` +
          (skipped > 0 ? ` · ${skipped} sem acesso ao app` : ""),
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar os avisos");
    } finally {
      setSending(false);
    }
  }

  if (!any) return null;

  return (
    <>
      <SectionCard
        title="Pacotes e check-ins"
        description="Renovações que precisam de contato"
        icon={CalendarClock}
        actions={
          <Button
            variant="ghost"
            size="sm"
            className="transition-ui"
            onClick={() => navigate({ to: "/students" })}
          >
            Ver alunos
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <AlertTile
            tone={tiles.expiring.tone}
            icon={tiles.expiring.icon}
            count={groups.expiring.length}
            label={tiles.expiring.label}
            hint={tiles.expiring.hint}
            onClick={() => setView("expiring")}
          />
          <AlertTile
            tone={tiles.low.tone}
            icon={tiles.low.icon}
            count={groups.low.length}
            label={tiles.low.label}
            hint={tiles.low.hint}
            onClick={() => setView("low")}
          />
        </div>
      </SectionCard>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto sm:max-w-2xl">
          {cfg && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset",
                      cfg.capsule,
                    )}
                  >
                    <cfg.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <DialogTitle className="text-base leading-tight">{cfg.title}</DialogTitle>
                    <DialogDescription className="mt-1">
                      {rows.length} aluno{rows.length === 1 ? "" : "s"} · {targets.length} com acesso ao app
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
                {rows.map((row) => (
                  <li key={row.studentId}>
                    <button
                      type="button"
                      onClick={() => {
                        setView(null);
                        navigate({ to: "/students/$id", params: { id: row.studentId } });
                      }}
                      className="focus-ring group flex min-h-11 w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-200 hover:bg-muted/60 active:bg-muted"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold uppercase ring-1 ring-inset",
                          cfg.capsule,
                        )}
                      >
                        {row.name.slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {row.name}
                        </span>
                        <span className="text-caption mt-0.5 block truncate text-muted-foreground">
                          {row.plan ? `${row.plan} · ` : ""}
                          {row.validUntil
                            ? `válido até ${formatDateBR(row.validUntil)}`
                            : "sem validade definida"}
                          {row.hasAccount ? "" : " · sem acesso ao app"}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "text-numeric shrink-0 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset",
                          cfg.capsule,
                        )}
                      >
                        {row.remaining}/{row.quota}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                    </button>
                  </li>
                ))}
              </ul>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setView(null)} className="transition-ui">
                  Fechar
                </Button>
                <Button
                  onClick={notifyAll}
                  disabled={sending || targets.length === 0}
                  className="transition-ui"
                >
                  {sending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : notified[view!] ? (
                    <BellRing className="mr-1.5 h-4 w-4" />
                  ) : (
                    <Send className="mr-1.5 h-4 w-4" />
                  )}
                  {sending
                    ? "Enviando…"
                    : notified[view!]
                      ? "Avisar novamente"
                      : `Avisar ${targets.length} aluno${targets.length === 1 ? "" : "s"}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

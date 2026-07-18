import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getAgenda, type AgendaSession } from "@/lib/classes.functions";

const DOW_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function weekStart(d: Date): Date {
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMonday);
  s.setHours(0, 0, 0, 0);
  return s;
}
function fmtDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(d.getDate() + n);
  return c;
}

export function AgendaView({
  renderCard,
}: {
  renderCard: (session: AgendaSession) => ReactNode;
}) {
  const [anchor, setAnchor] = useState(() => weekStart(new Date()));
  const [programId, setProgramId] = useState<string>("all");
  const fetchAgenda = useServerFn(getAgenda);

  const from = anchor;
  const to = addDays(anchor, 6);

  const { data: programs = [] } = useQuery({
    queryKey: ["agenda-programs"],
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("id,name,color").order("name");
      return data ?? [];
    },
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const mobileFrom = today;
  const mobileTo = addDays(today, 6);
  // Range que cobre tanto a semana (desktop) quanto os próximos 7 dias (mobile)
  const rangeFrom = from < mobileFrom ? from : mobileFrom;
  const rangeTo = to > mobileTo ? to : mobileTo;

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["agenda", fmtDateKey(rangeFrom), fmtDateKey(rangeTo), programId],
    queryFn: () =>
      fetchAgenda({
        data: { from: fmtDateKey(rangeFrom), to: fmtDateKey(rangeTo), programId: programId === "all" ? null : programId },
      }),
  });

  const byDay = useMemo(() => {
    const map: Record<string, AgendaSession[]> = {};
    for (let i = 0; i < 7; i++) map[fmtDateKey(addDays(from, i))] = [];
    for (const s of sessions) {
      if (map[s.session_date]) map[s.session_date].push(s);
    }
    return map;
  }, [sessions, from]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setAnchor(addDays(anchor, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(weekStart(new Date()))}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => setAnchor(addDays(anchor, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-2 text-sm font-medium">
            {from.toLocaleDateString("pt-BR")} — {to.toLocaleDateString("pt-BR")}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={programId} onValueChange={setProgramId}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os programas</SelectItem>
              {programs.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground text-center">Carregando…</Card>
      ) : (
        (() => {
          const todayKey = fmtDateKey(new Date());
          const days = Array.from({ length: 7 }).map((_, i) => {
            const d = addDays(from, i);
            const key = fmtDateKey(d);
            return { d, key, list: byDay[key] ?? [], isToday: todayKey === key, isPast: key < todayKey };
          });
          const mobileDays = days.filter((x) => !x.isPast);
          const renderDay = (x: typeof days[number]) => (
            <div key={x.key} className="space-y-2">
              <div className={`text-xs font-semibold uppercase text-center pb-1 border-b ${x.isToday ? "text-primary border-primary" : "text-muted-foreground"}`}>
                {DOW_FULL[x.d.getDay()].slice(0, 3)} {x.d.getDate()}
              </div>
              {x.list.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">—</div>
              ) : (
                x.list.map((s) => <div key={s.id}>{renderCard(s)}</div>)
              )}
            </div>
          );
          return (
            <>
              {/* Desktop: full week */}
              <div className="hidden md:grid gap-3 md:grid-cols-7">
                {days.map(renderDay)}
              </div>
              {/* Mobile: feed a partir de hoje */}
              <div className="grid gap-3 md:hidden">
                {mobileDays.length === 0 ? (
                  <Card className="p-6 text-sm text-muted-foreground text-center">
                    Sem próximos dias nesta semana.
                  </Card>
                ) : (
                  mobileDays.map(renderDay)
                )}
              </div>
            </>
          );
        })()
      )}
    </div>
  );
}

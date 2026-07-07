import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { AgendaView } from "@/components/edufinance/AgendaView";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Studio" }] }),
  component: AgendaPage,
});

function AgendaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Sessões geradas pelas suas turmas. Cada card mostra a ocupação em tempo real.
        </p>
      </div>

      <AgendaView
        renderCard={(s) => (
          <Card className="p-2 space-y-1 border-l-4" style={{ borderLeftColor: s.program_color ?? "#94a3b8" }}>
            <div className="text-xs font-semibold">{String(s.start_time).slice(0, 5)}</div>
            <div className="text-sm font-medium truncate">{s.class_name}</div>
            {s.program_name && (
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                {s.program_name}
              </div>
            )}
            {s.trainer_name && (
              <div className="text-xs text-muted-foreground truncate">{s.trainer_name}</div>
            )}
            <div className={`text-[10px] font-mono ${s.filled >= s.capacity ? "text-destructive" : "text-emerald-600"}`}>
              {s.filled}/{s.capacity}
            </div>
          </Card>
        )}
      />
    </div>
  );
}

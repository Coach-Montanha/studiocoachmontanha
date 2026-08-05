import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Loader2, RefreshCw, Search, CheckCircle2 } from "lucide-react";

import {
  listHybridExercises,
  importHybridExercises,
} from "@/lib/hybrid-import.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export function ImportExercisesPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listHybridExercises);
  const doImport = useServerFn(importHybridExercises);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["hybrid-exercises"],
    queryFn: () => list({}),
    staleTime: 60_000,
  });

  const exercises = data?.exercises ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.muscle_group ?? "").toLowerCase().includes(q),
    );
  }, [exercises, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function run(ids?: string[]) {
    setBusy(true);
    try {
      const res = await doImport({ data: ids?.length ? { ids } : {} });
      toast.success(
        `${res.imported} novo(s) movimento(s)` +
          (res.updated ? ` · ${res.updated} atualizado(s)` : "") +
          (res.skipped ? ` · ${res.skipped} já completos` : ""),
      );

      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["pt-library"] });
      qc.invalidateQueries({ queryKey: ["exercise-library"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao importar exercícios");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Banco de exercícios da origem</h2>
            <p className="text-sm text-muted-foreground">
              Importa os movimentos do Sistema Híbrido de Treinamento direto para a sua
              biblioteca. Nomes já existentes são ignorados.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching || busy}
              className="gap-2"
            >
              <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Atualizar
            </Button>
            <Button
              onClick={() => run(Array.from(selected))}
              disabled={busy || exercises.length === 0}
              className="gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {selected.size > 0 ? `Importar ${selected.size}` : "Importar todos"}
            </Button>
          </div>
        </div>
      </div>

      {data && !data.ok ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {data.error === "not_configured"
            ? "Integração não configurada."
            : `Não foi possível ler a origem: ${data.error}`}
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar exercício na origem…"
          className="h-11 pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando exercícios…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Nenhum exercício encontrado na origem.
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {filtered.length} exercício(s) disponíveis
            {selected.size > 0 ? ` · ${selected.size} selecionado(s)` : ""}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.map((e) => (
              <label
                key={e.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-muted/40"
              >
                <Checkbox
                  checked={selected.has(e.id)}
                  onCheckedChange={() => toggle(e.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.name}</div>
                  {e.muscle_group ? (
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {e.muscle_group}
                    </Badge>
                  ) : null}
                </div>
                {e.media_url ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : null}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

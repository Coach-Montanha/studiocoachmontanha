import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type SearchNavItem = { to: string; label: string; section?: string };

/**
 * Paleta de comandos global (⌘K / Ctrl+K).
 * Navega entre páginas e vai direto à ficha de um aluno (Studio ou PT).
 * A lista de alunos só é buscada quando o diálogo abre — nada de custo no load.
 */
export function GlobalSearch({ items }: { items: SearchNavItem[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: people = [] } = useQuery({
    queryKey: ["global-search-people"],
    enabled: open,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [studio, pt] = await Promise.all([
        supabase.from("students").select("id,name").is("deleted_at", null).limit(400),
        supabase.from("pt_students").select("id,name").limit(400),
      ]);
      return [
        ...(studio.data ?? []).map((s) => ({ ...s, kind: "studio" as const })),
        ...(pt.data ?? []).map((s) => ({ ...s, kind: "pt" as const })),
      ];
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, SearchNavItem[]>();
    for (const it of items) {
      const key = it.section ?? "Navegação";
      map.set(key, [...(map.get(key) ?? []), it]);
    }
    return [...map.entries()];
  }, [items]);

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "focus-ring group flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 text-muted-foreground transition-ui",
          "hover:border-primary/30 hover:bg-muted hover:text-foreground",
        )}
        aria-label="Buscar"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden text-sm sm:inline">Buscar…</span>
        <kbd className="hidden shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[0.625rem] font-medium sm:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar páginas ou alunos…" />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          {groups.map(([section, list]) => (
            <CommandGroup key={section} heading={section}>
              {list.map((it) => (
                <CommandItem key={it.to} value={`${section} ${it.label}`} onSelect={() => go(it.to)}>
                  {it.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          {people.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Alunos">
                {people.map((p) => (
                  <CommandItem
                    key={`${p.kind}-${p.id}`}
                    value={`${p.name} ${p.kind}`}
                    onSelect={() =>
                      go(p.kind === "studio" ? `/students/${p.id}` : `/personal-trainer/students/${p.id}`)
                    }
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-caption ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                      {p.kind === "studio" ? "Studio" : "PT"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

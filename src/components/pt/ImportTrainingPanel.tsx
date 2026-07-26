import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronRight,
  ClipboardPaste,
  Dumbbell,
  Check,
  Copy,
  KeyRound,
  Layers,
  Link2Off,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  getHybridStatus,
  listHybridPrograms,
  fetchHybridProgram,
  importHybridProgram,
  flattenHybridProgram,
  HybridProgramSchema,
  type HybridProgram,
  type HybridProgramSummary,
} from "@/lib/hybrid-import.functions";

import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


function methodologyLabel(m?: string | null) {
  if (!m) return null;
  const map: Record<string, string> = {
    hibrido: "Híbrido",
    kettlebell_sport: "Kettlebell Sport",
    kettlebell_fitness: "Kettlebell Fitness",
    levantamento_peso: "Levantamento de peso",
    musculacao: "Musculação",
  };
  return map[m] ?? m;
}

export function ImportTrainingPanel() {
  const navigate = useNavigate();
  const status = useServerFn(getHybridStatus);
  const list = useServerFn(listHybridPrograms);
  const fetchOne = useServerFn(fetchHybridProgram);
  const runImport = useServerFn(importHybridProgram);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [manualProgram, setManualProgram] = useState<HybridProgram | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string>("");
  const [showToStudent, setShowToStudent] = useState(true);
  const [importing, setImporting] = useState(false);

  const statusQ = useQuery({ queryKey: ["hybrid-status"], queryFn: () => status(), staleTime: 5 * 60_000 });
  const configured = statusQ.data?.configured ?? false;

  const programsQ = useQuery({
    queryKey: ["hybrid-programs"],
    queryFn: () => list(),
    enabled: configured,
    staleTime: 60_000,
  });

  const remoteQ = useQuery({
    queryKey: ["hybrid-program", selectedId],
    queryFn: () => fetchOne({ data: { id: selectedId! } }),
    enabled: Boolean(selectedId) && configured,
  });

  const studentsQ = useQuery({
    queryKey: ["pt-students-import"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pt_students")
        .select("id,name,status")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const program: HybridProgram | null = manualProgram ?? (remoteQ.data as HybridProgram | undefined) ?? null;
  const days = useMemo(() => (program ? flattenHybridProgram(program) : []), [program]);
  const totalExercises = days.reduce((s, d) => s + d.exercises.length, 0);

  function parseManual(value: string) {
    setManual(value);
    setManualError(null);
    if (!value.trim()) {
      setManualProgram(null);
      return;
    }
    try {
      const parsed = HybridProgramSchema.parse(JSON.parse(value));
      setManualProgram(parsed);
      setSelectedId(null);
    } catch (e: any) {
      setManualProgram(null);
      setManualError(
        e?.name === "SyntaxError" ? "JSON inválido — verifique a colagem." : "Formato não reconhecido.",
      );
    }
  }

  async function handleImport() {
    if (!program || !studentId) return;
    setImporting(true);
    try {
      const res = await runImport({
        data: {
          ptStudentId: studentId,
          program,
          showToStudent,
        },
      });
      toast.success(`Treino importado para ${res.studentName}`, {
        description: `${res.days} dia(s) · ${res.exercises} exercício(s)`,
      });
      navigate({ to: "/personal-trainer/students/$id", params: { id: studentId } }).catch(() => {});
    } catch (e: any) {
      toast.error("Falha ao importar", { description: e?.message ?? "Erro desconhecido" });
    } finally {
      setImporting(false);
    }
  }

  const canImport = Boolean(program && studentId) && !importing;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
      <PageHeader
        icon={ArrowLeftRight}
        eyebrow="Integração entre projetos"
        title="Importar treino do Sistema Híbrido"
        description="Traga um programa gerado no Sistema Híbrido de Treinamento e aplique como rotina de um aluno de Personal Trainer. A importação cria uma cópia — o original continua intacto na origem."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ConnectionChip
              loading={statusQ.isLoading}
              configured={configured}
              error={programsQ.data?.ok === false ? (programsQ.data.error ?? null) : null}
            />
            {configured && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => programsQ.refetch()}
                disabled={programsQ.isFetching}
                className="transition-ui"
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", programsQ.isFetching && "animate-spin")} />
                Atualizar
              </Button>
            )}
          </div>
        }

      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Origem */}
        <div className="space-y-4">
          <SectionCard
            icon={Sparkles}
            title="Origem do treino"
            description="Escolha um programa publicado ou cole o JSON"
            bodyClassName="p-0"
            padded={false}
          >
            <Tabs defaultValue={configured ? "remote" : "manual"} className="w-full">
              <div className="border-b border-border px-4 pt-3 sm:px-5">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="remote">Conectado</TabsTrigger>
                  <TabsTrigger value="manual">Colar JSON</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="remote" className="m-0 p-4 sm:p-5">
                {statusQ.isLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : !configured ? (
                  <NotConfigured />
                ) : programsQ.isLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : programsQ.data?.ok === false ? (
                  <div className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4">
                    <p className="text-caption text-destructive">
                      {programsQ.data.error === "not_configured"
                        ? "Integração ainda não configurada."
                        : programsQ.data.error}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 transition-ui"
                      onClick={() => programsQ.refetch()}
                      disabled={programsQ.isFetching}
                    >
                      <RefreshCw className={cn("mr-2 h-4 w-4", programsQ.isFetching && "animate-spin")} />
                      Tentar novamente
                    </Button>
                  </div>

                ) : (programsQ.data?.programs.length ?? 0) === 0 ? (
                  <p className="text-caption rounded-lg border border-dashed border-border bg-muted/30 p-4 text-muted-foreground">
                    Nenhum programa disponível na origem.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {programsQ.data!.programs.map((p) => (
                      <ProgramRow
                        key={p.id}
                        program={p}
                        active={selectedId === p.id}
                        onSelect={() => {
                          setSelectedId(p.id);
                          setManualProgram(null);
                          setManual("");
                        }}
                      />
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="manual" className="m-0 space-y-3 p-4 sm:p-5">
                <Label htmlFor="hybrid-json" className="text-caption text-muted-foreground">
                  Cole o JSON do programa exportado no Sistema Híbrido
                </Label>
                <Textarea
                  id="hybrid-json"
                  value={manual}
                  onChange={(e) => parseManual(e.target.value)}
                  placeholder={'{\n  "title": "Bloco de força",\n  "weeks": [ … ]\n}'}
                  className="min-h-[180px] font-mono text-xs leading-relaxed transition-ui"
                />
                {manualError ? (
                  <p className="text-caption text-destructive">{manualError}</p>
                ) : manualProgram ? (
                  <p className="text-caption flex items-center gap-1.5 text-state-paid">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Programa reconhecido
                  </p>
                ) : (
                  <p className="text-caption text-muted-foreground">
                    Aceita o formato normalizado com <code className="rounded bg-muted px-1">weeks</code>{" "}
                    ou <code className="rounded bg-muted px-1">sessions</code>.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </SectionCard>
        </div>

        {/* Preview + destino */}
        <div className="space-y-6">
          <SectionCard
            icon={Layers}
            title="Pré-visualização"
            description={
              program ? `${days.length} dia(s) · ${totalExercises} exercício(s)` : "Nada selecionado ainda"
            }
          >
            {remoteQ.isFetching ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : !program ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <Dumbbell className="h-6 w-6" />
                </span>
                <p className="text-body font-medium text-foreground">Selecione um programa</p>
                <p className="text-caption max-w-xs text-muted-foreground">
                  Escolha na lista ao lado ou cole o JSON para ver a estrutura antes de importar.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-section text-foreground">{program.title}</h3>
                  {program.methodology && (
                    <Badge variant="secondary">{methodologyLabel(program.methodology)}</Badge>
                  )}
                  {program.start_date && (
                    <span className="text-caption tabular-nums text-muted-foreground">
                      início {program.start_date}
                    </span>
                  )}
                </div>
                <ul className="space-y-2">
                  {days.map((d, i) => (
                    <li
                      key={`${d.day_label}-${i}`}
                      className="rounded-lg border border-border bg-surface-sunken/60 p-3 transition-ui hover:bg-muted/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-body min-w-0 truncate font-medium text-foreground">{d.name}</p>
                        <Badge variant="outline" className="shrink-0 tabular-nums">
                          {d.exercises.length} ex.
                        </Badge>
                      </div>
                      {d.exercises.length > 0 && (
                        <p className="text-caption mt-1.5 line-clamp-2 text-muted-foreground">
                          {d.exercises.map((e) => e.name).join(" · ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Users} title="Destino" description="Aluno de Personal Trainer que receberá a rotina">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="pt-student" className="text-caption text-muted-foreground">
                  Aluno PT
                </Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger id="pt-student" className="transition-ui">
                    <SelectValue
                      placeholder={studentsQ.isLoading ? "Carregando alunos…" : "Selecione o aluno"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(studentsQ.data ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken/60 px-3 py-2.5">
                <Switch id="show-student" checked={showToStudent} onCheckedChange={setShowToStudent} />
                <Label htmlFor="show-student" className="text-caption cursor-pointer text-foreground">
                  Visível para o aluno
                </Label>
              </div>
            </div>

            <div className="mt-5 hidden justify-end lg:flex">
              <Button onClick={handleImport} disabled={!canImport} className="min-w-44 transition-ui">
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando…
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Importar treino
                  </>
                )}
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>

      {!statusQ.isLoading && !configured && (
        <div className="mt-6 space-y-6">
          <SetupGuide />
          <RequestForOrigin />
        </div>
      )}


      {/* Barra de ação fixa no mobile */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
        <Button onClick={handleImport} disabled={!canImport} className="w-full transition-ui">
          {importing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importando…
            </>
          ) : (
            <>
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Importar treino
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ProgramRow({
  program,
  active,
  onSelect,
}: {
  program: HybridProgramSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className={cn(
          "group flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-ui",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          active
            ? "border-primary/40 bg-primary/10"
            : "border-border bg-card hover:border-border hover:bg-muted/40 active:bg-muted/60",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-ui",
            active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Dumbbell className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-body block truncate font-medium text-foreground">{program.title}</span>
          <span className="text-caption block truncate text-muted-foreground">
            {[
              methodologyLabel(program.methodology),
              program.weeks_count ? `${program.weeks_count} semana(s)` : null,
              program.start_date,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </span>
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-ui",
            active ? "text-primary" : "text-muted-foreground/50 group-hover:text-muted-foreground",
          )}
        />
      </button>
    </li>
  );
}

function ConnectionChip({
  loading,
  configured,
  error,
}: {
  loading: boolean;
  configured: boolean;
  error: string | null;
}) {
  const state = loading
    ? { label: "Verificando…", cls: "border-border bg-muted/40 text-muted-foreground", Icon: Loader2, spin: true }
    : !configured || error === "not_configured"
      ? { label: "Não configurado", cls: "border-border bg-muted/40 text-muted-foreground", Icon: Link2Off, spin: false }
      : error
        ? { label: "Falha na conexão", cls: "border-destructive/40 bg-destructive/10 text-destructive", Icon: Link2Off, spin: false }
        : { label: "Conectado", cls: "border-state-paid/30 bg-state-paid-soft text-state-paid", Icon: CheckCircle2, spin: false };

  return (
    <span
      className={cn(
        "text-caption inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition-ui",
        state.cls,
      )}
    >
      <state.Icon className={cn("h-3.5 w-3.5", state.spin && "animate-spin")} />
      {state.label}
    </span>
  );
}

function NotConfigured() {

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 shrink-0 text-muted-foreground">
          <Link2Off className="h-4 w-4" />
        </span>
        <div className="space-y-2">
          <p className="text-body font-medium text-foreground">Conexão ainda não configurada</p>
          <p className="text-caption text-muted-foreground">
            Para listar os programas automaticamente, o Sistema Híbrido precisa expor{" "}
            <code className="rounded bg-muted px-1">/api/public/programs</code> protegido por token, e
            este projeto precisa dos segredos <strong>HYBRID_API_URL</strong> e{" "}
            <strong>HYBRID_API_TOKEN</strong>. Enquanto isso, use a aba{" "}
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <ClipboardPaste className="h-3.5 w-3.5" /> Colar JSON
            </span>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

const SETUP_STEPS = [
  {
    title: "Gere um token aleatório",
    body: "No terminal, rode openssl rand -hex 32 (ou use um gerador de senha forte com 64 caracteres). Esse mesmo valor será usado nos dois projetos.",
  },
  {
    title: "Salve no Sistema Híbrido",
    body: "Abra o projeto de origem e vá em Cloud → Secrets. Adicione o segredo STUDIO_INTEGRATION_TOKEN com o valor gerado.",
  },
  {
    title: "Salve aqui no StudioCoach",
    body: "Neste projeto, vá em Cloud → Secrets e adicione HYBRID_API_TOKEN com o mesmo valor. O HYBRID_API_URL já está configurado.",
  },
  {
    title: "Exponha os endpoints na origem",
    body: "No Sistema Híbrido, crie /api/public/programs e /api/public/programs/:id exigindo o header Authorization: Bearer <token>.",
  },
];

function SetupGuide() {
  return (
    <SectionCard
      icon={KeyRound}
      title="Onde encontrar os Secrets"
      description="Secrets não fica em Configurações do workspace — fica dentro do menu Cloud de cada projeto"
    >
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Desktop
            </p>
            <p className="text-body mt-2 leading-relaxed text-foreground">
              Nome do projeto (canto superior esquerdo) → <strong>Cloud</strong> →{" "}
              <strong>Secrets</strong>
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Mobile
            </p>
            <p className="text-body mt-2 leading-relaxed text-foreground">
              Modo Chat → menu <strong>···</strong> → <strong>Cloud</strong> →{" "}
              <strong>Secrets</strong>
            </p>
          </div>
        </div>

        <ol className="space-y-4">
          {SETUP_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden
                className="text-caption grid h-7 w-7 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 font-semibold text-primary"
              >
                {i + 1}
              </span>
              <div className="space-y-1 pt-0.5">
                <p className="text-body font-medium leading-snug text-foreground">{step.title}</p>
                <p className="text-caption leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="text-caption rounded-lg border border-dashed border-border bg-muted/20 p-3 leading-relaxed text-muted-foreground">
          Sem permissão de owner/admin no projeto? Só owners e admins conseguem gravar segredos —
          peça para o responsável colar o token. Enquanto isso, a aba{" "}
          <span className="font-medium text-foreground">Colar JSON</span> importa treinos
          normalmente.
        </p>
      </div>
    </SectionCard>
  );
}

const ORIGIN_REQUEST = `Preciso expor dois endpoints públicos protegidos por token para que outro
projeto meu (StudioCoach) consiga importar os programas de treino daqui.

1) Crie o secret STUDIO_INTEGRATION_TOKEN (Cloud → Secrets). Vou colar o valor.

2) Crie GET /api/public/programs
   - Exige header: Authorization: Bearer <STUDIO_INTEGRATION_TOKEN>
   - Sem token válido → 401
   - Retorna: { "programs": [ { "id", "name", "description", "updated_at" } ] }

3) Crie GET /api/public/programs/:id
   - Mesma autenticação
   - Retorna o programa completo no formato:
     {
       "id", "name", "description",
       "weeks": [ { "label", "days": [ { "label", "exercises": [
         { "name", "sets", "reps", "load", "rest_seconds", "notes", "video_url" }
       ] } ] } ]
     }
   - Se o id não existir → 404

4) Não retorne dados pessoais de alunos nesses endpoints — apenas os
   programas/treinos.`;

function RequestForOrigin() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(ORIGIN_REQUEST);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  return (
    <SectionCard
      icon={Send}
      title="Solicitação para o Sistema Híbrido"
      description="Copie o texto abaixo e cole no chat do projeto de origem"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="w-full transition-ui sm:w-auto"
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4 text-state-paid" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copiar solicitação
            </>
          )}
        </Button>
      }
    >
      <div className="space-y-4">
        <pre className="text-caption max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 font-mono leading-relaxed text-foreground">
          {ORIGIN_REQUEST}
        </pre>
        <p className="text-caption leading-relaxed text-muted-foreground">
          Depois de colar lá e gerar o <strong className="font-medium text-foreground">STUDIO_INTEGRATION_TOKEN</strong>,
          volte aqui e salve o mesmo valor como{" "}
          <strong className="font-medium text-foreground">HYBRID_API_TOKEN</strong> em Cloud → Secrets.
        </p>
      </div>
    </SectionCard>
  );
}

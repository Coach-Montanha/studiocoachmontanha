import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Edit,
  Activity,
  Bone,
  Stethoscope,
  Pill,
  Moon,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getStudentAnamnesis,
  saveStudentAnamnesis,
  PARQ_QUESTIONS,
  type StudentAnamnesis,
  extractClinicalAlerts,
} from "@/lib/anamnesis";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/lib/format";

export function AnamnesisTab({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: anamnesis, isLoading } = useQuery({
    queryKey: ["pt-student-anamnesis", studentId],
    queryFn: () => getStudentAnamnesis(studentId),
  });

  const [form, setForm] = useState<Partial<StudentAnamnesis>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (anamnesis) {
      setForm(anamnesis);
    } else {
      setForm({
        parq_heart_condition: false,
        parq_chest_pain_activity: false,
        parq_chest_pain_rest: false,
        parq_dizziness: false,
        parq_bone_joint_problem: false,
        parq_blood_pressure_meds: false,
        parq_other_reason: false,
        joint_spine: false,
        joint_knee: false,
        joint_shoulder: false,
        joint_hip: false,
        joint_ankle: false,
        risk_level: "low",
      });
    }
  }, [anamnesis, dialogOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveStudentAnamnesis(studentId, form);
      toast.success("Anamnese e questionário de prontidão salvos com sucesso!", {
        icon: "🩺",
      });
      qc.invalidateQueries({ queryKey: ["pt-student-anamnesis", studentId] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(`Erro ao salvar anamnese: ${err?.message || "Tente novamente"}`);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-6">Carregando dados da anamnese...</div>;
  }

  const alerts = extractClinicalAlerts(anamnesis);
  const isHighRisk = anamnesis?.risk_level === "high";
  const isModerateRisk = anamnesis?.risk_level === "moderate";

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Aba */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary" />
            Anamnese Digital & Questionário PAR-Q
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Avaliação de prontidão para atividade física, restrições articulares e histórico de saúde do aluno.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5 font-bold shadow-sm">
          <Edit className="h-4 w-4" />
          {anamnesis ? "Editar Anamnese" : "Preencher Anamnese"}
        </Button>
      </div>

      {!anamnesis ? (
        <Card className="p-8 text-center bg-muted/20 border-dashed rounded-3xl space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-foreground">Nenhuma anamnese registrada ainda</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Cadastre o questionário de prontidão para atividade física (PAR-Q) e mapeie restrições ortopédicas para gerar alertas automáticos nos treinos.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} variant="outline" className="mt-2 text-xs font-bold">
            Cadastrar Primeira Anamnese
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Card de Grau de Risco e Alertas Ativos */}
          <div
            className={cn(
              "rounded-3xl border p-5 sm:p-6 transition-all",
              isHighRisk
                ? "border-red-500/40 bg-red-500/[0.04]"
                : isModerateRisk
                ? "border-amber-500/40 bg-amber-500/[0.04]"
                : "border-emerald-500/40 bg-emerald-500/[0.04]",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-2xl",
                    isHighRisk
                      ? "bg-red-500/20 text-red-600 dark:text-red-400"
                      : isModerateRisk
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {isHighRisk ? (
                    <ShieldAlert className="h-6 w-6" />
                  ) : isModerateRisk ? (
                    <AlertTriangle className="h-6 w-6" />
                  ) : (
                    <ShieldCheck className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Grau de Risco para Exercício
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wider",
                        isHighRisk
                          ? "bg-red-500 text-white"
                          : isModerateRisk
                          ? "bg-amber-500 text-black"
                          : "bg-emerald-500 text-white",
                      )}
                    >
                      {isHighRisk ? "Alto Risco" : isModerateRisk ? "Risco Moderado" : "Baixo Risco (Apto)"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {isHighRisk
                      ? "Atenção: O aluno relatou condições cardíacas ou desconfortos no peito. Recomenda-se liberação médica formal."
                      : isModerateRisk
                      ? "O aluno possui histórico de dores articulares ou uso de medicamentos. Ajuste as sobrecargas nos exercícios."
                      : "Aluno liberado para práticas de intensidade moderada e avançada sem restrições preliminares."}
                  </p>
                </div>
              </div>

              {anamnesis.updated_at && (
                <span className="text-xs text-muted-foreground font-mono">
                  Última atualização: {formatDateBR(anamnesis.updated_at)}
                </span>
              )}
            </div>

            {alerts.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  Alertas Ativos vinculados aos treinos:
                </span>
                <div className="flex flex-wrap gap-2">
                  {alerts.map((a, i) => (
                    <span
                      key={i}
                      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300"
                    >
                      ⚠️ {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Respostas do Questionário PAR-Q */}
            <Card className="p-5 sm:p-6 space-y-4 rounded-3xl">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Respostas PAR-Q (Prontidão Internacional)
              </h3>
              <div className="space-y-2.5">
                {PARQ_QUESTIONS.map((q) => {
                  const isYes = Boolean((anamnesis as any)[q.key]);
                  return (
                    <div
                      key={q.key}
                      className={cn(
                        "flex items-start justify-between gap-3 p-3 rounded-2xl border text-xs transition-all",
                        isYes
                          ? "border-red-500/40 bg-red-500/[0.04]"
                          : "border-border/60 bg-muted/20",
                      )}
                    >
                      <span className="flex-1 text-foreground/90 font-medium leading-snug">
                        {q.question}
                      </span>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 font-bold uppercase text-[10px] shrink-0",
                          isYes
                            ? "bg-red-500 text-white"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                        )}
                      >
                        {isYes ? "Sim" : "Não"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Mapeamento Articular & Histórico Clínico */}
            <div className="space-y-6">
              <Card className="p-5 sm:p-6 space-y-4 rounded-3xl">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Bone className="h-4 w-4 text-primary" />
                  Mapeamento de Articulações & Lesões
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: "joint_spine", label: "Coluna / Lombar" },
                    { key: "joint_knee", label: "Joelhos" },
                    { key: "joint_shoulder", label: "Ombros" },
                    { key: "joint_hip", label: "Quadril" },
                    { key: "joint_ankle", label: "Tornozelos" },
                  ].map((j) => {
                    const active = Boolean((anamnesis as any)[j.key]);
                    return (
                      <div
                        key={j.key}
                        className={cn(
                          "flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all",
                          active
                            ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            : "border-border/60 bg-muted/20 text-muted-foreground",
                        )}
                      >
                        {active ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        )}
                        <span>{j.label}</span>
                      </div>
                    );
                  })}
                </div>

                {anamnesis.orthopedic_injuries && (
                  <div className="rounded-2xl bg-muted/40 border p-3 text-xs">
                    <span className="font-bold text-muted-foreground uppercase text-[10px] block mb-1">
                      Lesões e Dores Específicas
                    </span>
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                      {anamnesis.orthopedic_injuries}
                    </p>
                  </div>
                )}
              </Card>

              <Card className="p-5 sm:p-6 space-y-3.5 rounded-3xl">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  Histórico Médico & Rotina
                </h3>

                <div className="space-y-2.5 text-xs">
                  {anamnesis.medical_conditions && (
                    <div className="rounded-xl border bg-muted/20 p-2.5">
                      <span className="font-bold text-muted-foreground block text-[10px] uppercase">
                        Condições Médicas / Patologias
                      </span>
                      <span className="text-foreground">{anamnesis.medical_conditions}</span>
                    </div>
                  )}

                  {anamnesis.medications && (
                    <div className="rounded-xl border bg-muted/20 p-2.5">
                      <span className="font-bold text-muted-foreground block text-[10px] uppercase">
                        Medicamentos de Uso Contínuo
                      </span>
                      <span className="text-foreground">{anamnesis.medications}</span>
                    </div>
                  )}

                  {anamnesis.contraindications && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/[0.04] p-2.5">
                      <span className="font-bold text-red-600 dark:text-red-400 block text-[10px] uppercase">
                        Contraindicações / Exercícios a Evitar
                      </span>
                      <span className="text-foreground font-medium">{anamnesis.contraindications}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="rounded-xl border bg-muted/20 p-2.5">
                      <span className="font-bold text-muted-foreground block text-[10px] uppercase">
                        Horas de Sono
                      </span>
                      <span className="text-foreground font-bold">
                        {anamnesis.sleep_hours ? `${anamnesis.sleep_hours}h por noite` : "Não informado"}
                      </span>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-2.5">
                      <span className="font-bold text-muted-foreground block text-[10px] uppercase">
                        Nível de Estresse
                      </span>
                      <span className="text-foreground font-bold capitalize">
                        {anamnesis.stress_level || "Moderado"}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Formulário Completo da Anamnese */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-primary" />
              Formulário de Anamnese & PAR-Q
            </DialogTitle>
            <DialogDescription>
              Preencha o questionário de prontidão e mapeie restrições físicas para gerar alertas automáticos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Bloco 1: PAR-Q */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                1. Questionário de Prontidão (PAR-Q)
              </h4>
              <div className="space-y-2 rounded-2xl border bg-muted/20 p-3">
                {PARQ_QUESTIONS.map((q) => (
                  <div key={q.key} className="flex items-start gap-3 py-1 border-b border-border/40 last:border-0">
                    <Checkbox
                      id={q.key}
                      checked={Boolean((form as any)[q.key])}
                      onCheckedChange={(c) => setForm((prev) => ({ ...prev, [q.key]: Boolean(c) }))}
                      className="mt-0.5"
                    />
                    <Label htmlFor={q.key} className="text-xs font-normal leading-relaxed cursor-pointer flex-1">
                      {q.question}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Bloco 2: Articulações */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                2. Articulações com Dor ou Histórico de Lesão
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { key: "joint_spine", label: "Coluna / Lombar" },
                  { key: "joint_knee", label: "Joelhos" },
                  { key: "joint_shoulder", label: "Ombros" },
                  { key: "joint_hip", label: "Quadril" },
                  { key: "joint_ankle", label: "Tornozelos" },
                ].map((j) => (
                  <div key={j.key} className="flex items-center gap-2 rounded-xl border p-2.5 bg-muted/20">
                    <Checkbox
                      id={j.key}
                      checked={Boolean((form as any)[j.key])}
                      onCheckedChange={(c) => setForm((prev) => ({ ...prev, [j.key]: Boolean(c) }))}
                    />
                    <Label htmlFor={j.key} className="text-xs cursor-pointer font-medium">
                      {j.label}
                    </Label>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Detalhes de Lesões Ortopédicas / Cirurgias</Label>
                <Textarea
                  placeholder="Ex: Hérnia discal L4-L5 diagnosticada em 2024, condromalácia patelar grau 2 no joelho direito..."
                  value={form.orthopedic_injuries || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, orthopedic_injuries: e.target.value }))}
                  className="text-xs min-h-[70px]"
                />
              </div>
            </div>

            {/* Bloco 3: Histórico Clínico & Hábitos */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                3. Condições Médicas, Medicamentos & Estilo de Vida
              </h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Condições Médicas / Patologias</Label>
                  <Input
                    placeholder="Ex: Hipertensão, Asma..."
                    value={form.medical_conditions || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, medical_conditions: e.target.value }))}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Medicamentos de Uso Contínuo</Label>
                  <Input
                    placeholder="Ex: Losartana 50mg..."
                    value={form.medications || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, medications: e.target.value }))}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Exercícios Contraindicados / Evitar no Treino</Label>
                <Input
                  placeholder="Ex: Não prescrever agachamento livre pesado nem supino declinado..."
                  value={form.contraindications || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, contraindications: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Horas de Sono por Noite</Label>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="Ex: 7.5"
                    value={form.sleep_hours || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, sleep_hours: parseFloat(e.target.value) || null }))}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nível de Estresse Habitual</Label>
                  <Select
                    value={form.stress_level || "moderate"}
                    onValueChange={(val) => setForm((prev) => ({ ...prev, stress_level: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixo (Tranquilo)</SelectItem>
                      <SelectItem value="moderate">Moderado</SelectItem>
                      <SelectItem value="high">Alto (Estressante)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="font-bold">
              {saving ? "Salvando..." : "Salvar Anamnese"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

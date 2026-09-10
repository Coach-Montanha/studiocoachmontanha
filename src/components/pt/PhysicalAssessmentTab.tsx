import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Camera, Scale, Activity, TrendingDown, TrendingUp, Sparkles, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { ImageComparison } from "@/components/ui/image-comparison";
import { formatDateBR } from "@/lib/format";
import {
  fetchPhysicalAssessments,
  savePhysicalAssessment,
  deletePhysicalAssessment,
  calculateBMI,
  getBMICategory,
  type PhysicalAssessment,
} from "@/lib/physical-assessment";

export function PhysicalAssessmentTab({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [comparisonType, setComparisonType] = useState<"photo_front" | "photo_side" | "photo_back">("photo_front");

  const [form, setForm] = useState<Partial<PhysicalAssessment>>({
    assessment_date: new Date().toISOString().slice(0, 10),
  });

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ["pt-student-assessments", studentId],
    queryFn: () => fetchPhysicalAssessments(studentId),
  });

  const latest = assessments[0];
  const oldest = assessments[assessments.length - 1];

  const bmi = latest ? calculateBMI(latest.weight, latest.height) : 0;
  const bmiCategory = getBMICategory(bmi);

  const weightDelta = latest && oldest && assessments.length > 1 ? latest.weight - oldest.weight : null;

  // Chart data
  const chartData = useMemo(() => {
    return [...assessments]
      .reverse()
      .map((a) => ({
        date: formatDateBR(a.assessment_date),
        peso: a.weight,
        gordura: a.body_fat_percentage ?? undefined,
      }));
  }, [assessments]);

  // Comparison photos
  const photoHistory = useMemo(() => {
    return assessments.filter((a) => a[comparisonType]);
  }, [assessments, comparisonType]);

  const beforePhoto = photoHistory[photoHistory.length - 1]?.[comparisonType];
  const afterPhoto = photoHistory[0]?.[comparisonType];

  const handleOpenNew = () => {
    setForm({
      assessment_date: new Date().toISOString().slice(0, 10),
      height: latest?.height || undefined,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.weight || !form.height || !form.assessment_date) {
      toast.error("Preencha ao menos data, peso e altura.");
      return;
    }

    try {
      await savePhysicalAssessment(studentId, form as any);
      toast.success("Avaliação física salva com sucesso!");
      qc.invalidateQueries({ queryKey: ["pt-student-assessments", studentId] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este registro de avaliação física?")) return;
    await deletePhysicalAssessment(id, studentId);
    toast.success("Avaliação excluída.");
    qc.invalidateQueries({ queryKey: ["pt-student-assessments", studentId] });
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" /> Avaliação Física & Composição Corporal
          </h2>
          <p className="text-xs text-muted-foreground">
            Acompanhe a evolução antropométrica, percentual de gordura e comparação fotográfica
          </p>
        </div>
        <Button onClick={handleOpenNew}>
          <Plus className="h-4 w-4 mr-1" /> Nova Avaliação
        </Button>
      </div>

      {assessments.length === 0 && !isLoading ? (
        <EmptyState
          icon={<Scale className="h-8 w-8" />}
          title="Nenhuma avaliação física registrada"
          description="Cadastre a primeira avaliação para acompanhar peso, medidas e fotos de evolução deste aluno."
          action={
            <Button onClick={handleOpenNew}>
              <Plus className="h-4 w-4 mr-1" /> Fazer 1ª Avaliação
            </Button>
          }
        />
      ) : (
        <>
          {/* Quick Metrics */}
          {latest && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Peso Atual
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-foreground tabular-nums">{latest.weight} kg</span>
                  {weightDelta !== null && (
                    <span
                      className={`text-xs font-semibold flex items-center ${
                        weightDelta <= 0 ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {weightDelta <= 0 ? <TrendingDown className="h-3 w-3 mr-0.5" /> : <TrendingUp className="h-3 w-3 mr-0.5" />}
                      {weightDelta > 0 ? `+${weightDelta.toFixed(1)}` : weightDelta.toFixed(1)} kg
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">Última aferição: {formatDateBR(latest.assessment_date)}</p>
              </Card>

              <Card className="p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Índice de Massa Corporal (IMC)
                </span>
                <div className="text-2xl font-bold text-foreground tabular-nums">{bmi}</div>
                <span
                  className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    bmiCategory.tone === "success"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-amber-500/10 text-amber-600"
                  }`}
                >
                  {bmiCategory.label}
                </span>
              </Card>

              <Card className="p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  % de Gordura Corporal
                </span>
                <div className="text-2xl font-bold text-foreground tabular-nums">
                  {latest.body_fat_percentage ? `${latest.body_fat_percentage}%` : "—"}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {latest.muscle_mass_percentage ? `Massa magra: ${latest.muscle_mass_percentage}%` : "Bioimpedância / Dobras"}
                </p>
              </Card>

              <Card className="p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total de Aferições
                </span>
                <div className="text-2xl font-bold text-foreground tabular-nums">{assessments.length}</div>
                <p className="text-[10px] text-muted-foreground">Histórico desde {formatDateBR(oldest.assessment_date)}</p>
              </Card>
            </div>
          )}

          {/* Visual Before & After Slider */}
          {beforePhoto && afterPhoto && photoHistory.length >= 2 && (
            <Card className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Comparador Visual Antes vs. Depois
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Arraste a linha central para visualizar a transformação física
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setComparisonType("photo_front")}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      comparisonType === "photo_front" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Frente
                  </button>
                  <button
                    type="button"
                    onClick={() => setComparisonType("photo_side")}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      comparisonType === "photo_side" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Lado
                  </button>
                  <button
                    type="button"
                    onClick={() => setComparisonType("photo_back")}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      comparisonType === "photo_back" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Costas
                  </button>
                </div>
              </div>

              <div className="max-w-md mx-auto">
                <ImageComparison
                  beforeImage={beforePhoto}
                  afterImage={afterPhoto}
                  beforeLabel={`Antes (${formatDateBR(photoHistory[photoHistory.length - 1].assessment_date)})`}
                  afterLabel={`Depois (${formatDateBR(photoHistory[0].assessment_date)})`}
                  aspectRatio="portrait"
                />
              </div>
            </Card>
          )}

          {/* Evolution Chart */}
          {chartData.length >= 2 && (
            <Card className="p-5 space-y-3">
              <h3 className="text-sm font-bold text-foreground">Evolução de Peso ao Longo do Tempo</h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="peso" name="Peso (kg)" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Assessments History Table / Cards */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Histórico de Avaliações</h3>
            <div className="space-y-3">
              {assessments.map((a) => (
                <div key={a.id} className="rounded-lg border border-border/80 bg-muted/20 p-4 transition-all hover:bg-muted/30">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-primary">{formatDateBR(a.assessment_date)}</span>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                        <span className="font-semibold">{a.weight} kg</span>
                        <span className="text-muted-foreground">·</span>
                        <span>{a.height} cm</span>
                        <span className="text-muted-foreground">·</span>
                        <span>IMC: {calculateBMI(a.weight, a.height)}</span>
                        {a.body_fat_percentage && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-amber-600 font-medium">{a.body_fat_percentage}% Gordura</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Measurements grid */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs border-t border-border/50 pt-2.5">
                    {a.chest && <div><span className="text-muted-foreground">Tórax:</span> <span className="font-medium">{a.chest}cm</span></div>}
                    {a.waist && <div><span className="text-muted-foreground">Cintura:</span> <span className="font-medium">{a.waist}cm</span></div>}
                    {a.abdomen && <div><span className="text-muted-foreground">Abdômen:</span> <span className="font-medium">{a.abdomen}cm</span></div>}
                    {a.hips && <div><span className="text-muted-foreground">Quadril:</span> <span className="font-medium">{a.hips}cm</span></div>}
                    {a.right_arm && <div><span className="text-muted-foreground">Braço D:</span> <span className="font-medium">{a.right_arm}cm</span></div>}
                    {a.left_arm && <div><span className="text-muted-foreground">Braço E:</span> <span className="font-medium">{a.left_arm}cm</span></div>}
                    {a.right_thigh && <div><span className="text-muted-foreground">Coxa D:</span> <span className="font-medium">{a.right_thigh}cm</span></div>}
                    {a.left_thigh && <div><span className="text-muted-foreground">Coxa E:</span> <span className="font-medium">{a.left_thigh}cm</span></div>}
                  </div>

                  {a.notes && <p className="mt-2 text-xs italic text-muted-foreground">"{a.notes}"</p>}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* New Assessment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Avaliação Física</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Data da Avaliação *</Label>
                <Input
                  type="date"
                  value={form.assessment_date ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, assessment_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Peso (kg) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 78.5"
                  value={form.weight ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Altura (cm) *</Label>
                <Input
                  type="number"
                  placeholder="Ex: 175"
                  value={form.height ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, height: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>% de Gordura Corporal</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 16.2"
                  value={form.body_fat_percentage ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, body_fat_percentage: Number(e.target.value) || null }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>% de Massa Muscular</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 42.0"
                  value={form.muscle_mass_percentage ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, muscle_mass_percentage: Number(e.target.value) || null }))}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/60">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Perímetros e Medidas (cm)
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Input
                  placeholder="Tórax (cm)"
                  type="number"
                  step="0.5"
                  value={form.chest ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, chest: Number(e.target.value) || null }))}
                />
                <Input
                  placeholder="Cintura (cm)"
                  type="number"
                  step="0.5"
                  value={form.waist ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, waist: Number(e.target.value) || null }))}
                />
                <Input
                  placeholder="Abdômen (cm)"
                  type="number"
                  step="0.5"
                  value={form.abdomen ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, abdomen: Number(e.target.value) || null }))}
                />
                <Input
                  placeholder="Quadril (cm)"
                  type="number"
                  step="0.5"
                  value={form.hips ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, hips: Number(e.target.value) || null }))}
                />
                <Input
                  placeholder="Braço D (cm)"
                  type="number"
                  step="0.5"
                  value={form.right_arm ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, right_arm: Number(e.target.value) || null }))}
                />
                <Input
                  placeholder="Braço E (cm)"
                  type="number"
                  step="0.5"
                  value={form.left_arm ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, left_arm: Number(e.target.value) || null }))}
                />
                <Input
                  placeholder="Coxa D (cm)"
                  type="number"
                  step="0.5"
                  value={form.right_thigh ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, right_thigh: Number(e.target.value) || null }))}
                />
                <Input
                  placeholder="Coxa E (cm)"
                  type="number"
                  step="0.5"
                  value={form.left_thigh ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, left_thigh: Number(e.target.value) || null }))}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/60">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                URLs das Fotos de Avaliação (Frente, Lado, Costas)
              </Label>
              <div className="space-y-2">
                <Input
                  placeholder="URL Foto Frente (https://...)"
                  value={form.photo_front ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, photo_front: e.target.value }))}
                />
                <Input
                  placeholder="URL Foto Lado / Perfil (https://...)"
                  value={form.photo_side ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, photo_side: e.target.value }))}
                />
                <Input
                  placeholder="URL Foto Costas (https://...)"
                  value={form.photo_back ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, photo_back: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observações do Avaliador</Label>
              <Textarea
                rows={2}
                placeholder="Ex: Aluno relata melhora na disposição. Redução visível na circunferência abdominal."
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar Avaliação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Download, Sparkles, Calendar, Award } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateStudentMonthlyReportPdf } from "@/lib/student-monthly-report-pdf";

export interface StudentMonthlyReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    goal?: string | null;
    planName?: string | null;
  };
  sessions: any[];
  executions: any[];
}

export function StudentMonthlyReportDialog({
  open,
  onOpenChange,
  student,
  sessions,
  executions,
}: StudentMonthlyReportDialogProps) {
  const [selectedMonthOffset, setSelectedMonthOffset] = useState("0"); // 0 = mês atual, 1 = mês passado...
  const [coachNotes, setCoachNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Gera opções dos últimos 6 meses
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), i);
    const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
    return {
      value: String(i),
      date,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    };
  });

  const selectedDate = subMonths(new Date(), parseInt(selectedMonthOffset, 10));
  const refYear = selectedDate.getFullYear();
  const refMonth = selectedDate.getMonth();

  // Contagem de treinos do mês selecionado
  const monthSessions = sessions.filter((s) => {
    const d = new Date(s.session_date);
    return d.getFullYear() === refYear && d.getMonth() === refMonth && s.status === "completed";
  });

  const monthExecutions = executions.filter((x) => {
    const d = new Date(x.executed_at);
    return d.getFullYear() === refYear && d.getMonth() === refMonth;
  });

  const totalWorkouts = Math.max(monthSessions.length, monthExecutions.length);

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    try {
      await generateStudentMonthlyReportPdf({
        student,
        referenceDate: selectedDate,
        sessions,
        executions,
        coachNotes: coachNotes.trim() || undefined,
        coachName: "Studio Coach Montanha",
      });
      toast.success("Relatório executivo em PDF gerado com sucesso!", {
        icon: "📄",
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Falha ao gerar relatório: ${err?.message || "Tente novamente"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
            <Award className="h-4 w-4" />
            <span>Documentação Profissional</span>
          </div>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Relatório Mensal do Aluno
          </DialogTitle>
          <DialogDescription>
            Gere um documento executivo em PDF de alto padrão contendo frequência, tonelagem levantada, PRs de carga, histórico antropométrico e parecer do treinador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Aluno & Mês de Referência */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Mês de Referência</Label>
            <Select value={selectedMonthOffset} onValueChange={setSelectedMonthOffset}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mini-Cards Informativos */}
          <div className="grid grid-cols-2 gap-2.5 rounded-2xl bg-muted/40 border border-border/80 p-3">
            <div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Treinos no Mês
              </span>
              <span className="font-mono text-xl font-black text-foreground">
                {totalWorkouts} sessões
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Aluno Selecionado
              </span>
              <span className="text-sm font-bold text-primary truncate block">
                {student.name}
              </span>
            </div>
          </div>

          {/* Parecer Técnico do Coach */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                Parecer Técnico & Diretrizes do Treinador
              </Label>
              <span className="text-[10px] text-muted-foreground">Opcional</span>
            </div>
            <Textarea
              placeholder="Ex: Excelente evolução de força no supino e agachamento. Manter o foco na cadência excêntrica e na hidratação para o próximo ciclo..."
              className="min-h-[90px] text-xs resize-y"
              value={coachNotes}
              onChange={(e) => setCoachNotes(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Se deixado em branco, uma mensagem padrão de parabéns e incentivo técnico será inserida no PDF.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button
            onClick={handleGeneratePdf}
            disabled={isGenerating}
            className="gap-1.5 font-bold shadow-md shadow-primary/20"
          >
            <Download className="h-4 w-4" />
            {isGenerating ? "Gerando Relatório..." : "Baixar Relatório PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

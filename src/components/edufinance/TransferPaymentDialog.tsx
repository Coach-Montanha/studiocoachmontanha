import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowRightLeft, Check, ChevronsUpDown, Loader2, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatBRL, formatMonthLong, initials } from "@/lib/format";

type PaymentSummary = {
  id: string;
  amount: number;
  reference_month: string;
  plans?: { name?: string | null } | null;
} | null;

export function TransferPaymentDialog({
  open,
  onOpenChange,
  paymentId,
  fromStudentId,
  fromStudentName,
  payment,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  paymentId: string | null;
  fromStudentId?: string | null;
  fromStudentName?: string | null;
  payment?: PaymentSummary;
}) {
  const qc = useQueryClient();
  const [targetId, setTargetId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTargetId("");
      setPickerOpen(false);
      setBusy(false);
    }
  }, [open]);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["transfer-students-all"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id,name").order("name");
      return data ?? [];
    },
  });

  const options = useMemo(
    () => students.filter((s: any) => s.id !== fromStudentId),
    [students, fromStudentId],
  );
  const target = useMemo(
    () => options.find((s: any) => s.id === targetId) as { id: string; name: string } | undefined,
    [options, targetId],
  );

  async function transfer() {
    if (!paymentId || !targetId) return toast.error("Selecione o aluno destino");
    setBusy(true);
    const { data, error } = await supabase
      .from("payments")
      .update({ student_id: targetId })
      .eq("id", paymentId)
      .select("id");
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data || data.length === 0) return toast.error("Sem permissão para transferir este pagamento.");
    toast.success("Pagamento transferido");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-lg leading-tight">Transferir pagamento</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                Move este pagamento para outro aluno. Nada além do vínculo é alterado.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {payment && (
          <div className="rounded-lg border border-border/70 bg-muted/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pagamento
              </span>
              <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                {formatBRL(payment.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="capitalize text-foreground/80">
                {formatMonthLong(payment.reference_month)}
              </span>
              {payment.plans?.name && (
                <span className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {payment.plans.name}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <StudentChip name={fromStudentName ?? "—"} muted />
            <ArrowRight className={cn("h-4 w-4 shrink-0 transition-colors duration-200", target ? "text-primary" : "text-muted-foreground/50")} />
            <StudentChip name={target?.name ?? "Selecione…"} highlight={!!target} placeholder={!target} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Aluno destino</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="w-full justify-between font-normal transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  <span className={cn("truncate", !target && "text-muted-foreground")}>
                    {target ? target.name : isLoading ? "Carregando alunos…" : "Buscar aluno…"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nome…" className="h-10" />
                  <CommandList>
                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                      Nenhum aluno encontrado.
                    </CommandEmpty>
                    <CommandGroup>
                      {options.map((s: any) => (
                        <CommandItem
                          key={s.id}
                          value={s.name}
                          onSelect={() => {
                            setTargetId(s.id);
                            setPickerOpen(false);
                          }}
                          className="gap-2"
                        >
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                            {initials(s.name)}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{s.name}</span>
                          <Check className={cn("h-4 w-4 text-primary transition-opacity duration-150", targetId === s.id ? "opacity-100" : "opacity-0")} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="transition-colors duration-200"
          >
            Cancelar
          </Button>
          <Button
            onClick={transfer}
            disabled={!targetId || busy}
            className="min-w-[130px] transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferindo…
              </>
            ) : (
              <>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transferir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudentChip({
  name,
  muted,
  highlight,
  placeholder,
}: {
  name: string;
  muted?: boolean;
  highlight?: boolean;
  placeholder?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors duration-200",
        highlight
          ? "border-primary/40 bg-primary/5"
          : placeholder
            ? "border-dashed border-border/60 bg-transparent"
            : "border-border/60 bg-muted/30",
      )}
    >
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
          highlight ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {placeholder ? <User className="h-3.5 w-3.5" /> : initials(name)}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-xs font-medium",
          placeholder ? "text-muted-foreground/70" : muted ? "text-foreground/80" : "text-foreground",
        )}
      >
        {name}
      </span>
    </div>
  );
}

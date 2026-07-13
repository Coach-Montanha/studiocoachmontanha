import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function TransferPaymentDialog({
  open,
  onOpenChange,
  paymentId,
  fromStudentId,
  fromStudentName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  paymentId: string | null;
  fromStudentId?: string | null;
  fromStudentName?: string | null;
}) {
  const qc = useQueryClient();
  const [targetId, setTargetId] = useState<string>("");

  useEffect(() => {
    if (open) setTargetId("");
  }, [open]);

  const { data: students = [] } = useQuery({
    queryKey: ["transfer-students-all"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id,name").order("name");
      return data ?? [];
    },
  });

  const options = students.filter((s: any) => s.id !== fromStudentId);

  async function transfer() {
    if (!paymentId || !targetId) return toast.error("Selecione o aluno destino");
    const { data, error } = await supabase
      .from("payments")
      .update({ student_id: targetId })
      .eq("id", paymentId)
      .select("id");
    if (error) return toast.error(error.message);
    if (!data || data.length === 0) return toast.error("Sem permissão para transferir este pagamento.");
    toast.success("Pagamento transferido");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir pagamento</DialogTitle>
          <DialogDescription>
            {fromStudentName
              ? <>Transferir de <strong>{fromStudentName}</strong> para outro aluno.</>
              : "Selecione o aluno destino."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Aluno destino</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {options.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={transfer}>Transferir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

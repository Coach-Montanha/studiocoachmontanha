import { useState } from "react";
import { confirmDialog } from "@/lib/confirm-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Trash2, Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/edufinance/EmptyState";

type ContractsTabProps = {
  studentId: string;
  tableName: "student_contracts" | "pt_student_contracts";
  foreignKey: "student_id" | "pt_student_id";
};

export function ContractsTab({ studentId, tableName, foreignKey }: ContractsTabProps) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [signedAt, setSignedAt] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: [tableName, studentId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from(tableName)
        .select("*")
        .eq(foreignKey, studentId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function uploadContract() {
    if (!file) return toast.error("Selecione um arquivo.");
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Não autenticado");

      const ext = file.name.split(".").pop();
      const filePath = `${userId}/${studentId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { error: dbError } = await (supabase as any).from(tableName).insert({
        user_id: userId,
        [foreignKey]: studentId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        notes: notes || null,
        signed_at: signedAt || null,
      });

      if (dbError) throw dbError;

      toast.success("Contrato enviado com sucesso!");
      setUploadOpen(false);
      setFile(null);
      setNotes("");
      setSignedAt("");
      qc.invalidateQueries({ queryKey: [tableName, studentId] });
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
    setUploading(false);
  }

  async function downloadContract(filePath: string, fileName: string) {
    const { data, error } = await supabase.storage
      .from("contracts")
      .download(filePath);
    if (error || !data) return toast.error("Erro ao baixar arquivo.");
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteContract(id: string, filePath: string) {
    if (!(await confirmDialog("Excluir este contrato?"))) return;
    await supabase.storage.from("contracts").remove([filePath]);
    await (supabase as any).from(tableName).delete().eq("id", id);
    toast.success("Contrato excluído.");
    qc.invalidateQueries({ queryKey: [tableName, studentId] });
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar contrato
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : contracts.length === 0 ? (
        <EmptyState title="Sem contratos" description="Nenhum contrato enviado para este aluno." />
      ) : (
        <div className="space-y-2">
          {contracts.map((c: any) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.file_name}</p>
                    <div className="mt-0.5 text-xs text-muted-foreground flex flex-wrap gap-1">
                      {c.file_size && <span>{formatFileSize(c.file_size)}</span>}
                      {c.signed_at && (
                        <span>
                          · Assinado em{" "}
                          {format(new Date(c.signed_at + "T12:00"), "dd/MM/yyyy")}
                        </span>
                      )}
                      <span>
                        · Enviado em{" "}
                        {format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    {c.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => downloadContract(c.file_path, c.file_name)}
                    title="Baixar"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteContract(c.id, c.file_path)}
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Arquivo (PDF, JPG, PNG)</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/40"
                onClick={() => document.getElementById("contract-file")?.click()}
              >
                <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                {file ? (
                  <p className="text-sm font-medium">{file.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo</p>
                )}
                <input
                  id="contract-file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Data de assinatura</Label>
              <Input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Contrato de prestação de serviços 2025"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={uploadContract} disabled={uploading}>
              {uploading ? "Enviando…" : "Enviar contrato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

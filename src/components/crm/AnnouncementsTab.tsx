import { useMemo, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Image as ImageIcon, Megaphone, Upload } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { confirmDialog } from "@/lib/confirm-dialog";
import {
  listMyAnnouncements,
  upsertAnnouncement,
  deleteAnnouncement,
  getSignedAnnouncementImageUrl,
  type AnnouncementRow,
} from "@/lib/announcements.functions";
import { AiImageGenerator } from "@/components/crm/AiImageGenerator";
import { formatDateBR } from "@/lib/format";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string) {
  // interpret as local, convert to ISO
  return new Date(v).toISOString();
}

type EditState = {
  id?: string;
  title: string;
  body: string;
  image_url: string | null;
  starts_at: string; // local input value
  ends_at: string;
  active: boolean;
};

const emptyEdit = (): EditState => {
  const now = new Date();
  const later = new Date(now.getTime() + 7 * 86_400_000);
  return {
    title: "",
    body: "",
    image_url: null,
    starts_at: toLocalInput(now.toISOString()),
    ends_at: toLocalInput(later.toISOString()),
    active: true,
  };
};

export function AnnouncementsTab() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listMyAnnouncements);
  const upsertFn = useServerFn(upsertAnnouncement);
  const deleteFn = useServerFn(deleteAnnouncement);
  const signFn = useServerFn(getSignedAnnouncementImageUrl);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["announcements-mine"],
    queryFn: () => fetchList(),
  });

  const [edit, setEdit] = useState<EditState | null>(null);
  const [uploading, setUploading] = useState(false);

  const openNew = () => setEdit(emptyEdit());
  const openEdit = (r: AnnouncementRow) => {
    setEdit({
      id: r.id,
      title: r.title ?? "",
      body: r.body ?? "",
      image_url: r.image_url,
      starts_at: toLocalInput(r.starts_at),
      ends_at: toLocalInput(r.ends_at),
      active: r.active,
    });
  };

  const saveMut = useMutation({
    mutationFn: async (state: EditState) => {
      await upsertFn({
        data: {
          id: state.id,
          title: state.title.trim() || null,
          body: state.body.trim() || null,
          image_url: state.image_url ?? null,
          starts_at: fromLocalInput(state.starts_at),
          ends_at: fromLocalInput(state.ends_at),
          active: state.active,
        },
      });
    },
    onSuccess: () => {
      toast.success("Aviso salvo");
      qc.invalidateQueries({ queryKey: ["announcements-mine"] });
      setEdit(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      await deleteFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Aviso excluído");
      qc.invalidateQueries({ queryKey: ["announcements-mine"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !edit) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB)");
      return;
    }
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${u.user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("announcements")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      setEdit({ ...edit, image_url: path });
      toast.success("Imagem enviada");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirmDialog({
      description: "Excluir este aviso? Ele deixará de ser exibido para os alunos.",
      destructive: true,
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    delMut.mutate(id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Avisos internos
          </h2>
          <p className="text-sm text-muted-foreground">
            Aparecem para os alunos na primeira vez que abrem o app dentro da janela de exibição.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo aviso
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum aviso criado ainda.
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <AnnouncementCard
              key={r.id}
              row={r}
              onEdit={() => openEdit(r)}
              onDelete={() => handleDelete(r.id)}
              signFn={signFn}
            />
          ))}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && !saveMut.isPending && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Editar aviso" : "Novo aviso"}</DialogTitle>
            <DialogDescription>
              Adicione texto, imagem ou ambos. Defina quando o aviso começa e quando encerra.
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ann-title">Título (opcional)</Label>
                <Input
                  id="ann-title"
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                  placeholder="Ex: Studio fechado no sábado"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-body">Mensagem</Label>
                <Textarea
                  id="ann-body"
                  value={edit.body}
                  onChange={(e) => setEdit({ ...edit, body: e.target.value })}
                  placeholder="Escreva a mensagem que será exibida ao aluno"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Imagem (opcional)</Label>
                {edit.image_url ? (
                  <ImagePreview
                    path={edit.image_url}
                    signFn={signFn}
                    onRemove={() => setEdit({ ...edit, image_url: null })}
                  />
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted">
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" /> Enviar imagem (máx 5MB)
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUpload}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ann-start">Início</Label>
                  <Input
                    id="ann-start"
                    type="datetime-local"
                    value={edit.starts_at}
                    onChange={(e) => setEdit({ ...edit, starts_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ann-end">Fim</Label>
                  <Input
                    id="ann-end"
                    type="datetime-local"
                    value={edit.ends_at}
                    onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="ann-active" className="text-sm">Aviso ativo</Label>
                  <p className="text-xs text-muted-foreground">
                    Desative para pausar a exibição sem excluir.
                  </p>
                </div>
                <Switch
                  id="ann-active"
                  checked={edit.active}
                  onCheckedChange={(v) => setEdit({ ...edit, active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={saveMut.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => edit && saveMut.mutate(edit)}
              disabled={saveMut.isPending || uploading}
            >
              {saveMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnnouncementCard({
  row,
  onEdit,
  onDelete,
  signFn,
}: {
  row: AnnouncementRow;
  onEdit: () => void;
  onDelete: () => void;
  signFn: ReturnType<typeof useServerFn<typeof getSignedAnnouncementImageUrl>>;
}) {
  const now = Date.now();
  const start = new Date(row.starts_at).getTime();
  const end = new Date(row.ends_at).getTime();
  const status = useMemo(() => {
    if (!row.active) return { label: "Pausado", cls: "bg-muted text-muted-foreground" };
    if (now < start) return { label: "Agendado", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" };
    if (now > end) return { label: "Encerrado", cls: "bg-muted text-muted-foreground" };
    return { label: "Exibindo", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" };
  }, [row.active, now, start, end]);

  return (
    <Card className="p-4">
      <div className="flex gap-3">
        {row.image_url && (
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
            <SignedThumb path={row.image_url} signFn={signFn} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.cls}`}>{status.label}</span>
            {row.title && <span className="font-semibold truncate">{row.title}</span>}
          </div>
          {row.body && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{row.body}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateBR(row.starts_at.slice(0, 10))}{" "}
            {new Date(row.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            {" → "}
            {formatDateBR(row.ends_at.slice(0, 10))}{" "}
            {new Date(row.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Excluir">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SignedThumb({
  path,
  signFn,
}: {
  path: string;
  signFn: ReturnType<typeof useServerFn<typeof getSignedAnnouncementImageUrl>>;
}) {
  const { data } = useQuery({
    queryKey: ["ann-thumb", path],
    queryFn: () => signFn({ data: { path } }),
    staleTime: 60 * 60 * 1000,
  });
  if (!data?.url) return <ImageIcon className="h-5 w-5 text-muted-foreground" />;
  return <img src={data.url} alt="" className="h-full w-full object-cover" />;
}

function ImagePreview({
  path,
  signFn,
  onRemove,
}: {
  path: string;
  signFn: ReturnType<typeof useServerFn<typeof getSignedAnnouncementImageUrl>>;
  onRemove: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["ann-preview", path],
    queryFn: () => signFn({ data: { path } }),
    staleTime: 60 * 60 * 1000,
  });
  return (
    <div className="relative overflow-hidden rounded-md border">
      {data?.url ? (
        <img src={data.url} alt="Prévia" className="max-h-48 w-full object-contain bg-muted" />
      ) : (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="absolute right-2 top-2"
        onClick={onRemove}
      >
        Remover
      </Button>
    </div>
  );
}

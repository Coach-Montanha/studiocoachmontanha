import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Database, Download, Loader2, Trash2, ExternalLink } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  listMyBuckets,
  listMyBucketFiles,
  signMyBucketFile,
  deleteMyBucketFile,
  type StorageBucketId,
} from "@/lib/storage-browser.functions";
import { confirmDialog } from "@/lib/confirm-dialog";

export const Route = createFileRoute("/_authenticated/storage")({
  head: () => ({ meta: [{ title: "Armazenamento — EduFinance" }] }),
  component: StoragePage,
});

function formatSize(n: number | null) {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function StoragePage() {
  const bucketsFn = useServerFn(listMyBuckets);
  const { data: buckets = [] } = useQuery({
    queryKey: ["my-buckets"],
    queryFn: () => bucketsFn(),
  });
  const [active, setActive] = useState<StorageBucketId>("announcements");

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/settings"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Database className="h-5 w-5" /> Armazenamento e mídia
        </h1>
        <p className="text-sm text-muted-foreground">
          Arquivos que o app guarda por você: imagens dos avisos (incluindo IA), fotos de alunos, contratos em PDF e mídia dos exercícios.
        </p>
      </div>

      <Tabs value={active} onValueChange={(v) => setActive(v as StorageBucketId)}>
        <TabsList className="flex flex-wrap gap-1">
          {buckets.map((b) => (
            <TabsTrigger key={b.id} value={b.id}>{b.label}</TabsTrigger>
          ))}
        </TabsList>
        {buckets.map((b) => (
          <TabsContent key={b.id} value={b.id}>
            <BucketBrowser bucket={b.id as StorageBucketId} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function BucketBrowser({ bucket }: { bucket: StorageBucketId }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyBucketFiles);
  const signFn = useServerFn(signMyBucketFile);
  const delFn = useServerFn(deleteMyBucketFile);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["my-bucket", bucket],
    queryFn: () => listFn({ data: { bucket } }),
  });

  const delMut = useMutation({
    mutationFn: async (path: string) => delFn({ data: { bucket, path } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-bucket", bucket] });
      toast.success("Arquivo excluído");
    },
    onError: (e: any) => toast.error(e?.message),
  });

  async function open(path: string) {
    const r = await signFn({ data: { bucket, path } });
    window.open(r.url, "_blank", "noopener");
  }
  async function handleDelete(path: string) {
    const ok = await confirmDialog({
      description: `Excluir este arquivo? Esta ação é permanente.`,
      destructive: true,
      confirmLabel: "Excluir",
    });
    if (ok) delMut.mutate(path);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Nenhum arquivo neste bucket ainda.
      </Card>
    );
  }

  const isImageBucket = bucket === "announcements" || bucket === "avatars" || bucket === "exercise-media";

  return (
    <div className={isImageBucket ? "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" : "space-y-2"}>
      {files.map((f) => (
        isImageBucket ? (
          <ImageTile key={f.path} bucket={bucket} path={f.path} name={f.name} size={f.size}
            onOpen={() => open(f.path)} onDelete={() => handleDelete(f.path)} signFn={signFn} />
        ) : (
          <Card key={f.path} className="flex items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatSize(f.size)} · {f.updated_at ? new Date(f.updated_at).toLocaleString("pt-BR") : "—"}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => open(f.path)} aria-label="Abrir">
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(f.path)} aria-label="Excluir">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </Card>
        )
      ))}
    </div>
  );
}

function ImageTile({
  bucket,
  path,
  name,
  size,
  onOpen,
  onDelete,
  signFn,
}: {
  bucket: StorageBucketId;
  path: string;
  name: string;
  size: number | null;
  onOpen: () => void;
  onDelete: () => void;
  signFn: ReturnType<typeof useServerFn<typeof signMyBucketFile>>;
}) {
  const { data } = useQuery({
    queryKey: ["bucket-thumb", bucket, path],
    queryFn: () => signFn({ data: { bucket, path } }),
    staleTime: 30 * 60 * 1000,
  });
  return (
    <Card className="group relative overflow-hidden">
      <button type="button" onClick={onOpen} className="block aspect-square w-full bg-muted">
        {data?.url ? (
          <img src={data.url} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </button>
      <div className="flex items-center justify-between gap-1 p-2">
        <span className="truncate text-xs" title={name}>{name}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{formatSize(size)}</span>
      </div>
      <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
        <Button size="icon" variant="secondary" onClick={onOpen} aria-label="Abrir" className="h-7 w-7">
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="secondary" onClick={onDelete} aria-label="Excluir" className="h-7 w-7">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </Card>
  );
}

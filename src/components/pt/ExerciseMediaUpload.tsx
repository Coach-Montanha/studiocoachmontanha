import { useState } from "react";
import { Upload, Play, ImageIcon, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type MediaType = "image" | "video" | "youtube";

interface ExerciseMediaUploadProps {
  mediaUrl?: string | null;
  mediaType?: string | null;
  onUpload: (url: string, type: MediaType) => void;
  onRemove: () => void;
}

export function ExerciseMediaUpload({
  mediaUrl,
  mediaType,
  onUpload,
  onRemove,
}: ExerciseMediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [showYoutube, setShowYoutube] = useState(false);

  async function handleFileUpload(file: File) {
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Arquivo maior que 100MB.");
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Não autenticado");

      const ext = file.name.split(".").pop();
      const isVideo = file.type.startsWith("video/");
      const filePath = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("exercise-media")
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      // Bucket privado — URL assinada com validade máxima (~100 anos) para uso perene.
      const { data: signed, error: signErr } = await supabase.storage
        .from("exercise-media")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 100);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Falha ao gerar URL");

      onUpload(signed.signedUrl, isVideo ? "video" : "image");
      toast.success("Mídia enviada com sucesso!");
    } catch (err: any) {
      toast.error(`Erro: ${err.message ?? err}`);
    }
    setUploading(false);
  }

  function handleYoutubeAdd() {
    if (!youtubeUrl.trim()) return;
    const match = youtubeUrl.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
    );
    if (!match) {
      toast.error("URL do YouTube inválida.");
      return;
    }
    const videoId = match[1];
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    onUpload(embedUrl, "youtube");
    setYoutubeUrl("");
    setShowYoutube(false);
  }

  const inputId = `exercise-media-input-${Math.random().toString(36).slice(2, 8)}`;

  if (mediaUrl) {
    return (
      <div className="relative overflow-hidden rounded-lg border bg-muted">
        {mediaType === "youtube" ? (
          <iframe
            src={mediaUrl}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : mediaType === "video" ? (
          <video src={mediaUrl} controls className="aspect-video w-full object-cover" />
        ) : (
          <img src={mediaUrl} alt="Exercício" loading="lazy" decoding="async" className="aspect-video w-full object-cover" />
        )}
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-card transition-ui hover:brightness-110"
          aria-label="Remover mídia"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors hover:bg-accent/30",
          uploading && "pointer-events-none opacity-50",
        )}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="mb-2 flex gap-3 text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
              <Play className="h-6 w-6" />
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Clique para enviar <span className="font-medium">foto ou vídeo</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, MP4 — até 100MB</p>
          </>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />
      </div>

      {!showYoutube ? (
        <button
          type="button"
          onClick={() => setShowYoutube(true)}
          className="w-full py-1 text-center text-xs text-primary hover:underline"
        >
          📺 Ou adicionar link do YouTube
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={handleYoutubeAdd}
            className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
          >
            Adicionar
          </button>
          <button
            type="button"
            onClick={() => setShowYoutube(false)}
            className="rounded-md border px-2 py-1.5 text-xs"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

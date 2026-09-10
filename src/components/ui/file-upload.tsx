import * as React from "react";
import { UploadCloud, FileText, Image as ImageIcon, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface FileUploadProps {
  value?: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  value,
  onChange,
  accept = ".pdf,.jpg,.jpeg,.png",
  maxSizeMB = 10,
  label = "Arraste e solte o arquivo aqui ou clique para selecionar",
  description,
  className,
  disabled = false,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (value && value.type.startsWith("image/")) {
      const url = URL.createObjectURL(value);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [value]);

  const validateAndSetFile = (file: File | null) => {
    setError(null);
    if (!file) {
      onChange(null);
      return;
    }

    // Validate size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`O arquivo excede o limite máximo de ${maxSizeMB}MB.`);
      return;
    }

    onChange(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = value?.type?.startsWith("image/");

  return (
    <div className={cn("w-full space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          validateAndSetFile(file);
          e.target.value = "";
        }}
      />

      {!value ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={cn(
            "group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer select-none",
            isDragOver
              ? "border-primary bg-primary/10 shadow-sm scale-[0.99]"
              : "border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-muted/40",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
            <UploadCloud className="h-6 w-6" />
          </div>

          <p className="mt-3 text-sm font-medium text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {description || `Arquivos suportados: ${accept.replace(/\./g, "").toUpperCase()} (máx. ${maxSizeMB}MB)`}
          </p>
        </div>
      ) : (
        <div className="relative flex items-center gap-3.5 rounded-xl border border-border bg-card p-3 shadow-2xs">
          {/* Thumbnail / Icon */}
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
            ) : isImage ? (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            ) : (
              <FileText className="h-6 w-6 text-primary" />
            )}
          </div>

          {/* File details */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{value.name}</p>
            <p className="text-xs text-muted-foreground">{formatSize(value.size)}</p>
          </div>

          {/* Remove / Clear button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => validateAndSetFile(null)}
            disabled={disabled}
            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
            title="Remover arquivo"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `há ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `há ${years} ${years === 1 ? "ano" : "anos"}`;
}

export function AiPromptPopover({
  prompt,
  generatedAt,
}: {
  prompt: string;
  generatedAt: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Prompt copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={[
            "group flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary",
            "transition-all duration-200 hover:bg-primary/15 hover:border-primary/50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "active:scale-[0.98]",
          ].join(" ")}
        >
          <Sparkles
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110"
            strokeWidth={2.25}
          />
          <span>Ver prompt IA</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-2rem))] p-0 overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 border-b bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">
                Prompt usado
              </div>
              {generatedAt && (
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  Gerado {relativeTime(generatedAt)}
                </div>
              )}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={copy}
            className="h-7 gap-1 px-2 text-xs"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </>
            )}
          </Button>
        </div>
        <div className="max-h-72 overflow-y-auto px-4 py-3">
          <pre className="whitespace-pre-wrap break-words border-l-2 border-primary/40 bg-muted/40 pl-3 py-1 font-sans text-sm leading-relaxed text-foreground">
{prompt}
          </pre>
        </div>
      </PopoverContent>
    </Popover>
  );
}

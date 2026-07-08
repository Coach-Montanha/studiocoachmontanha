import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<Notification | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const hydrated = useRef(false);

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,title,body,read_at,created_at")
        .eq("recipient_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as Notification[];
    },
    refetchInterval: 60_000,
  });

  const unread = useMemo(() => items.filter((n) => !n.read_at), [items]);

  // Detect new items → toast + pop-up for the newest unread
  useEffect(() => {
    if (!hydrated.current) {
      items.forEach((n) => seenIds.current.add(n.id));
      hydrated.current = true;
      return;
    }
    const fresh = items.filter((n) => !seenIds.current.has(n.id));
    fresh.forEach((n) => seenIds.current.add(n.id));
    const freshUnread = fresh.filter((n) => !n.read_at);
    if (freshUnread.length > 0) {
      const newest = freshUnread[0];
      toast.info(newest.title, { description: newest.body });
      setPopup(newest);
    }
  }, [items]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${user.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  async function markAllRead() {
    if (unread.length === 0) return;
    const ids = unread.map((n) => n.id);
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  }

  async function markRead(id: string) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Notificações${unread.length ? ` (${unread.length} não lidas)` : ""}`}
            className="relative h-9 w-9 rounded-full text-sidebar-foreground/80 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
          >
            <Bell className="h-4 w-4" />
            {unread.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground shadow ring-2 ring-sidebar">
                {unread.length > 9 ? "9+" : unread.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[min(22rem,calc(100vw-1.5rem))] p-0"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Notificações</div>
              <div className="text-[11px] text-muted-foreground">
                {unread.length > 0 ? `${unread.length} não lida${unread.length > 1 ? "s" : ""}` : "Tudo em dia"}
              </div>
            </div>
            {unread.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                className="h-8 gap-1.5 text-xs"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas
              </Button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-sm font-medium">Sem notificações</div>
                <div className="text-xs text-muted-foreground">
                  Você receberá avisos do seu studio por aqui.
                </div>
              </div>
            ) : (
              <ul className="divide-y">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => !n.read_at && markRead(n.id)}
                      className={cn(
                        "group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150",
                        "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                        !n.read_at && "bg-primary/[0.04]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full transition-colors",
                          n.read_at ? "bg-muted-foreground/30" : "bg-primary",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={cn("truncate text-sm", n.read_at ? "font-medium text-foreground/80" : "font-semibold text-foreground")}>
                            {n.title}
                          </p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatWhen(n.created_at)}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {n.body}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog
        open={!!popup}
        onOpenChange={(o) => {
          if (!o && popup) {
            markRead(popup.id);
            setPopup(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <DialogTitle className="text-center">{popup?.title}</DialogTitle>
            <DialogDescription className="whitespace-pre-wrap text-center leading-relaxed">
              {popup?.body}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-2">
            <Button
              onClick={() => {
                if (popup) markRead(popup.id);
                setPopup(null);
              }}
              className="min-w-32 transition-all duration-200"
            >
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

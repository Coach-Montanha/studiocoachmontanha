import { useState, useEffect } from "react";
import { Bell, BellDot, Check, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";

export function NotificationCenter() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [], refetch } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_notifications" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as any[];
    },
    // Polling notifications every 30 seconds
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markAsRead(id: string) {
    await supabase
      .from("pt_notifications" as any)
      .update({ read: true } as any)
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markAllAsRead() {
    if (!user) return;
    await supabase
      .from("pt_notifications" as any)
      .update({ read: true } as any)
      .eq("user_id", user.id)
      .eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function clearAll() {
    if (!user) return;
    await supabase
      .from("pt_notifications" as any)
      .delete()
      .eq("user_id", user.id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    if (notification.type === "training_complete" && notification.metadata?.student_id) {
      navigate({
        to: "/personal-trainer/students/$id",
        params: { id: notification.metadata.student_id },
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unreadCount > 0 ? (
            <>
              <BellDot className="h-5 w-5 text-primary animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            </>
          ) : (
            <Bell className="h-5 w-5 text-muted-foreground" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 shadow-xl border-border/50">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-bold">Notificações</h3>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-7 text-[10px] uppercase font-bold text-primary hover:text-primary hover:bg-primary/10"
              >
                Ler tudo
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearAll}
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[350px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/20 mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma notificação por aqui.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-1 border-b px-4 py-3 transition-colors hover:bg-muted/50",
                  !n.read && "bg-primary/[0.03]"
                )}
              >
                {!n.read && (
                  <div className="absolute left-1 top-4 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("text-xs font-bold leading-tight", !n.read ? "text-foreground" : "text-muted-foreground")}>
                    {n.title}
                  </span>
                  <span className="whitespace-nowrap text-[9px] text-muted-foreground uppercase font-medium">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  {n.message}
                </p>
              </div>
            ))
          )}
        </div>
        
        {notifications.length > 0 && (
          <div className="bg-muted/30 px-4 py-2 text-center border-t">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Apenas notificações recentes
            </span>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

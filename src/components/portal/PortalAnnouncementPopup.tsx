import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";
import {
  getActiveAnnouncementsForPortal,
  getSignedAnnouncementImageUrl,
} from "@/lib/announcements.functions";

export function PortalAnnouncementPopup() {
  const fetchList = useServerFn(getActiveAnnouncementsForPortal);
  const signFn = useServerFn(getSignedAnnouncementImageUrl);

  const { data: rows = [] } = useQuery({
    queryKey: ["portal-announcements"],
    queryFn: () => fetchList(),
    staleTime: 5 * 60 * 1000,
  });

  const [current, setCurrent] = useState<(typeof rows)[number] | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!rows.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const pick = rows.find((r) => {
      const key = `ann-seen-${r.id}-${today}`;
      return !sessionStorage.getItem(key) && !localStorage.getItem(key);
    });
    if (pick) setCurrent(pick);
  }, [rows]);

  useEffect(() => {
    let cancelled = false;
    setImgUrl(null);
    if (!current?.image_url) return;
    signFn({ data: { path: current.image_url } })
      .then((r) => {
        if (!cancelled) setImgUrl(r.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [current, signFn]);

  const close = () => {
    if (current) {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(`ann-seen-${current.id}-${today}`, "1");
    }
    setCurrent(null);
  };

  return (
    <Dialog open={!!current} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Megaphone className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center">
            {current?.title || "Aviso do studio"}
          </DialogTitle>
          {current?.body && (
            <DialogDescription className="whitespace-pre-line text-center">
              {current.body}
            </DialogDescription>
          )}
        </DialogHeader>
        {imgUrl && (
          <img
            src={imgUrl}
            alt={current?.title ?? "Aviso"}
            className="max-h-80 w-full rounded-md object-contain bg-muted"
          />
        )}
        <DialogFooter className="sm:justify-center">
          <Button onClick={close}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

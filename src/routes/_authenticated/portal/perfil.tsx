import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/portal/perfil")({
  head: () => ({ meta: [{ title: "Meus dados" }] }),
  component: PerfilPage,
});

function PerfilPage() {
  const { data: me } = useQuery({
    queryKey: ["portal-me-full"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("students")
        .select("id,name,email,phone,birth_date,status,created_at")
        .eq("account_user_id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function changePassword() {
    if (newPassword.length < 6) return toast.error("Mínimo 6 caracteres");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada!");
    setNewPassword("");
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Meus dados</h1>

      <Card className="p-6 space-y-3">
        <div className="grid gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <div className="text-base">{me?.name ?? "—"}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <div className="text-base">{me?.email ?? "—"}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Telefone</Label>
            <div className="text-base">{me?.phone ?? "—"}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Nascimento</Label>
            <div className="text-base">{me?.birth_date ? formatDateBR(me.birth_date) : "—"}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Aluno desde</Label>
            <div className="text-base">{me?.created_at ? formatDateBR(me.created_at) : "—"}</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Para alterar seus dados, entre em contato com o studio.
        </p>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="text-sm font-semibold">Alterar senha</h2>
        <div className="space-y-1.5">
          <Label>Nova senha</Label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <Button onClick={changePassword} disabled={loading}>
          {loading ? "Salvando…" : "Atualizar senha"}
        </Button>
      </Card>
    </div>
  );
}

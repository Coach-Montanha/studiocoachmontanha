import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, KeyRound, Copy, UserCog } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { formatDateBR } from "@/lib/format";
import {
  listTenants, createTrainer, setTenantModule, resetTrainerPassword, impersonateTrainer,
} from "@/lib/tenants.functions";
import { IMPERSONATE_STORAGE_KEY } from "@/hooks/use-impersonate";

const MODULES = [
  { key: "studio", label: "Studio" },
  { key: "pt", label: "Personal Trainer" },
  { key: "financeiro", label: "Financeiro" },
  { key: "crm", label: "CRM" },
] as const;
type ModuleKey = (typeof MODULES)[number]["key"];

export const Route = createFileRoute("/_authenticated/admin/tenants")({
  head: () => ({ meta: [{ title: "Treinadores — Admin" }] }),
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw redirect({ to: "/auth" });
    const { data: isSuper } = await supabase.rpc("is_super_admin", {
      _user_id: userRes.user.id,
    });
    if (!isSuper) throw redirect({ to: "/" });
  },
  component: TenantsPage,
});

function TenantsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTenants);
  const createFn = useServerFn(createTrainer);
  const setModuleFn = useServerFn(setTenantModule);
  const resetFn = useServerFn(resetTrainerPassword);
  const impersonateFn = useServerFn(impersonateTrainer);
  const navigate = useNavigate();

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: () => listFn(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [selMods, setSelMods] = useState<Set<ModuleKey>>(new Set());
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; tempPassword: string } | null>(null);

  async function handleCreate() {
    if (!email.includes("@")) return toast.error("E-mail inválido");
    setCreating(true);
    try {
      const res = await createFn({
        data: { email: email.trim(), modules: Array.from(selMods) },
      });
      setCredentials({ email: res.email, tempPassword: res.tempPassword });
      setCreateOpen(false);
      setEmail("");
      setSelMods(new Set());
      qc.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast.success("Treinador criado");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar");
    } finally {
      setCreating(false);
    }
  }

  async function toggleModule(userId: string, module: ModuleKey, active: boolean, expiresAt: string | null) {
    try {
      await setModuleFn({ data: { userId, module, active, expiresAt } });
      qc.invalidateQueries({ queryKey: ["admin-tenants"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function handleReset(userId: string, email: string) {
    try {
      const res = await resetFn({ data: { userId } });
      setCredentials({ email, tempPassword: res.tempPassword });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function handleImpersonate(userId: string, email: string) {
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const superEmail = sessionRes.session?.user.email ?? "super admin";
      const { tokenHash, targetEmail } = await impersonateFn({ data: { userId } });
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (error) throw error;
      localStorage.setItem(
        IMPERSONATE_STORAGE_KEY,
        JSON.stringify({
          targetEmail,
          targetUserId: userId,
          superAdminEmail: superEmail,
          startedAt: Date.now(),
        }),
      );
      await qc.cancelQueries();
      qc.clear();
      toast.success(`Você está visualizando como ${email}`);
      navigate({ to: "/", replace: true });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao entrar como treinador");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Treinadores</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie contas de treinadores e módulos contratados.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo treinador
        </Button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : !tenants || tenants.length === 0 ? (
          <EmptyState title="Nenhum treinador" description="Crie o primeiro treinador acima." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Criado</TableHead>
                  {MODULES.map((m) => (
                    <TableHead key={m.key} className="text-center">{m.label}</TableHead>
                  ))}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => {
                  const isSuper = t.roles.includes("super_admin");
                  return (
                    <TableRow key={t.userId}>
                      <TableCell className="font-medium">{t.email}</TableCell>
                      <TableCell>
                        {isSuper ? (
                          <Badge variant="default">super admin</Badge>
                        ) : (
                          <Badge variant="secondary">admin</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.createdAt ? formatDateBR(t.createdAt) : "—"}
                      </TableCell>
                      {MODULES.map((m) => {
                        const row = t.modules.find((x) => x.module === m.key);
                        const active = !!row?.active;
                        const expired = row?.expires_at
                          ? new Date(row.expires_at).getTime() < Date.now()
                          : false;
                        return (
                          <TableCell key={m.key} className="text-center">
                            {isSuper ? (
                              <Badge variant="outline">todos</Badge>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <Switch
                                  checked={active && !expired}
                                  onCheckedChange={(v) =>
                                    toggleModule(t.userId, m.key, v, row?.expires_at ?? null)
                                  }
                                />
                                <Input
                                  type="date"
                                  className="h-7 w-32 text-xs"
                                  value={row?.expires_at ? row.expires_at.slice(0, 10) : ""}
                                  onChange={(e) => {
                                    const v = e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : null;
                                    toggleModule(t.userId, m.key, active, v);
                                  }}
                                  title="Validade (opcional)"
                                />
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right">
                        {!isSuper && (
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleImpersonate(t.userId, t.email)}
                            >
                              <UserCog className="mr-1 h-3 w-3" /> Entrar como
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReset(t.userId, t.email)}
                            >
                              <KeyRound className="mr-1 h-3 w-3" /> Nova senha
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo treinador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="treinador@exemplo.com"
              />
            </div>
            <div>
              <Label>Módulos contratados</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {MODULES.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <Checkbox
                      checked={selMods.has(m.key)}
                      onCheckedChange={(v) => {
                        const next = new Set(selMods);
                        if (v) next.add(m.key); else next.delete(m.key);
                        setSelMods(next);
                      }}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Criando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!credentials} onOpenChange={(o) => !o && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credenciais geradas</DialogTitle>
          </DialogHeader>
          {credentials && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Salve ou envie estas credenciais agora. Elas não serão mostradas novamente.
              </p>
              <div className="rounded-md bg-muted p-3 font-mono text-sm">
                <div>E-mail: {credentials.email}</div>
                <div>Senha: {credentials.tempPassword}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `E-mail: ${credentials.email}\nSenha: ${credentials.tempPassword}`,
                  );
                  toast.success("Copiado");
                }}
              >
                <Copy className="mr-2 h-3 w-3" /> Copiar
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCredentials(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

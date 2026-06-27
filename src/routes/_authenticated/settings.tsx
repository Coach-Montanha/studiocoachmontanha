import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — EduFinance" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [academyName, setAcademyName] = useState(
    typeof window !== "undefined" ? localStorage.getItem("edufinance.academy") ?? "" : "",
  );
  const [fiscalMonth, setFiscalMonth] = useState(
    typeof window !== "undefined" ? localStorage.getItem("edufinance.fiscalMonth") ?? "1" : "1",
  );

  function save() {
    localStorage.setItem("edufinance.academy", academyName);
    localStorage.setItem("edufinance.fiscalMonth", fiscalMonth);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Preferências da sua conta</p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold">Perfil</h2>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold">Negócio</h2>
        <div className="space-y-1.5">
          <Label>Nome da escola / academia</Label>
          <Input value={academyName} onChange={(e) => setAcademyName(e.target.value)} placeholder="Minha Escola" />
        </div>
        <div className="space-y-1.5">
          <Label>Moeda padrão</Label>
          <Input value="BRL — Real brasileiro" disabled />
        </div>
        <div className="space-y-1.5">
          <Label>Mês inicial do ano fiscal</Label>
          <Input type="number" min={1} max={12} value={fiscalMonth} onChange={(e) => setFiscalMonth(e.target.value)} />
        </div>
        <Button onClick={save}>Salvar</Button>
      </Card>
    </div>
  );
}

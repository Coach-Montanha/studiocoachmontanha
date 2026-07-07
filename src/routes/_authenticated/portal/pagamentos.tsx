import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/portal/pagamentos")({
  head: () => ({ meta: [{ title: "Meus pagamentos" }] }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const { data: me } = useQuery({
    queryKey: ["portal-me-id2"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("students")
        .select("id")
        .eq("account_user_id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["portal-payments", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id,amount,payment_date,due_date,status,reference_month,payment_method")
        .eq("student_id", me!.id)
        .order("payment_date", { ascending: false });
      return data ?? [];
    },
  });

  const statusBadge = (status: string) => {
    if (status === "paid") return <Badge className="bg-emerald-500">Pago</Badge>;
    if (status === "pending") return <Badge variant="secondary">Pendente</Badge>;
    if (status === "overdue") return <Badge variant="destructive">Vencido</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Meus pagamentos</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referência</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Nenhum pagamento registrado
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.reference_month ?? "—"}</TableCell>
                  <TableCell>{p.payment_date ? formatDateBR(p.payment_date) : "—"}</TableCell>
                  <TableCell>{p.due_date ? formatDateBR(p.due_date) : "—"}</TableCell>
                  <TableCell className="text-xs">{p.payment_method ?? "—"}</TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(Number(p.amount))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

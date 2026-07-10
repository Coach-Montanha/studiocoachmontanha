import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2 } from "lucide-react";

import { listTenants } from "@/lib/tenants.functions";
import { useTenantScope } from "@/hooks/use-tenant-scope";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Sidebar control that lets the super_admin choose which tenant's data to
 * show in list/dashboard queries. Default is "own" so records from other
 * trainers don't mix into the super admin's view.
 */
export function TenantScopeSelector() {
  const qc = useQueryClient();
  const { scope, setScope } = useTenantScope();
  const fetchTenants = useServerFn(listTenants);

  const { data: tenants = [] } = useQuery({
    queryKey: ["tenants-list-scope"],
    queryFn: () => fetchTenants(),
    staleTime: 60_000,
  });

  return (
    <div className="mb-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-sidebar-foreground/70">
        <Building2 className="h-3 w-3" />
        Escopo dos dados
      </div>
      <Select
        value={scope}
        onValueChange={(v) => {
          setScope(v);
          qc.invalidateQueries();
        }}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="own">Meus dados</SelectItem>
          <SelectItem value="all">Todos os treinadores</SelectItem>
          {tenants.map((t) => (
            <SelectItem key={t.userId} value={t.userId}>
              {t.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

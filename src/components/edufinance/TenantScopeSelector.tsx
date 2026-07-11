import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2 } from "lucide-react";

import { listTenants } from "@/lib/tenants.functions";
import { useTenantScope } from "@/hooks/use-tenant-scope";
import { useAuth } from "@/hooks/use-auth";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Sidebar control that lets the super_admin choose which tenant's data to
 * show. Hierarchy: Super_Admin (self) → Treinadores (individual accounts) →
 * Todos os treinadores. Selecting a specific trainer scopes ALL data as if
 * the super admin were logged into that account.
 */
export function TenantScopeSelector() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { scope, setScope } = useTenantScope();
  const fetchTenants = useServerFn(listTenants);

  const { data: tenants = [] } = useQuery({
    queryKey: ["tenants-list-scope"],
    queryFn: () => fetchTenants(),
    staleTime: 60_000,
  });

  // Exclude the current super_admin from the trainer list (they appear as "Super_Admin").
  const trainers = tenants.filter((t) => t.userId !== user?.id);

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
          <SelectItem value="own">Super_Admin</SelectItem>
          {trainers.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-wide">
                Treinadores
              </SelectLabel>
              {trainers.map((t) => (
                <SelectItem key={t.userId} value={t.userId} className="pl-6">
                  › {t.email}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          <SelectItem value="all">Todos os treinadores</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

import { useModules, type AppModule } from "@/hooks/use-modules";

export type LandingOption = {
  path: string;
  label: string;
  module?: AppModule;
};

export const LANDING_OPTIONS: LandingOption[] = [
  { path: "/", label: "Dashboard" },
  { path: "/students", label: "Alunos", module: "studio" },
  { path: "/payments", label: "Pagamentos", module: "studio" },
  { path: "/plans", label: "Planos", module: "studio" },
  { path: "/agenda", label: "Turmas & Agenda", module: "studio" },
  { path: "/programs", label: "Programas", module: "studio" },
  { path: "/analytics", label: "Análises", module: "studio" },
  { path: "/personal-trainer", label: "Personal Trainer", module: "pt" },
  { path: "/personal-trainer/checkin", label: "⚡ Check-in Rápido (PT)", module: "pt" },
  { path: "/financeiro", label: "Financeiro", module: "financeiro" },
  { path: "/crm", label: "CRM", module: "crm" },
];

export const LANDING_STORAGE_KEY = "edufinance.landingPage";
export const LANDING_REDIRECT_FLAG = "edufinance.landingRedirected";

export function useLandingOptions() {
  const { hasModule } = useModules();
  return LANDING_OPTIONS.filter((o) => !o.module || hasModule(o.module));
}

export function getLandingPage(): string {
  if (typeof window === "undefined") return "/";
  return localStorage.getItem(LANDING_STORAGE_KEY) ?? "/";
}

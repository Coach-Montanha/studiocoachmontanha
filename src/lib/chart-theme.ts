/**
 * Tema único dos gráficos (Recharts).
 *
 * Tudo sai de tokens semânticos — nenhum valor de cor chumbado — para que o
 * modo escuro funcione sem ajuste manual em cada tela.
 */

export const chartAxis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

export const chartGrid = {
  strokeDasharray: "3 3",
  stroke: "var(--color-border)",
  vertical: false,
} as const;

/** Tooltip flutuante alinhado ao popover do design system. */
export const chartTooltip = {
  cursor: { fill: "color-mix(in oklab, var(--color-primary) 8%, transparent)" },
  contentStyle: {
    background: "var(--color-popover)",
    color: "var(--color-popover-foreground)",
    border: "1px solid var(--color-border)",
    borderRadius: "0.75rem",
    boxShadow: "var(--shadow-float)",
    padding: "0.5rem 0.75rem",
    fontSize: "0.8125rem",
  },
  labelStyle: {
    color: "var(--color-foreground)",
    fontWeight: 650,
    marginBottom: "0.25rem",
  },
  itemStyle: { color: "var(--color-popover-foreground)" },
} as const;

/** Paleta padrão para séries múltiplas (pizza, empilhados). */
export const chartSeries = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
];


# EduFinance — Plano de Construção

Sistema de gestão financeira de alunos em português (pt-BR), com Supabase (Lovable Cloud), dashboards, importação/exportação Excel e análises avançadas.

## Fase 1 — Fundação

1. **Ativar Lovable Cloud** (Supabase: banco, auth, RLS).
2. **Design system** em `src/styles.css`: paleta indigo/emerald/amber, Inter + JetBrains Mono, tokens semânticos (background, primary, accent, danger, warning, surface, border).
3. **Dependências**: `recharts`, `xlsx`, `papaparse`, `date-fns` (locale pt-BR). shadcn/ui e lucide-react já presentes.
4. **Layout base**: `_authenticated` route com sidebar fixa (240px, colapsável no mobile) + header com seletor mês/ano global e nome do usuário.

## Fase 2 — Banco de dados (migração única)

Tabelas com RLS por `user_id = auth.uid()`:

- `students` (+ `user_id`)
- `plans` (+ `user_id`)
- `payments` (herda ownership via student)
- `student_plan_history`

GRANTs para `authenticated` e `service_role` conforme template. Policies: cada usuário só vê/edita seus próprios registros. Índices em `student_id`, `reference_month`, `payment_date`.

Seed: trigger opcional `on_auth_user_created` cria 5 planos demo + 20 alunos + 12 meses de pagamentos realistas (apenas se a conta estiver vazia).

## Fase 3 — Autenticação

- `/auth`: login email/senha, signup, "lembrar de mim", reset de senha.
- `/reset-password`: define nova senha.
- Layout protegido `_authenticated/route.tsx` (gerenciado pela integração).

## Fase 4 — Páginas

1. `/` Dashboard — 4 KPI cards (receita do mês, alunos ativos, ticket médio, churn) com comparação MoM; gráficos Recharts (barras 12 meses, linha de alunos, donut por plano, barra horizontal por método); tabela últimos 10 pagamentos; seletor mês/ano global.
2. `/students` — lista filtrável/ordenável, drawer de criação, página de detalhe `/students/$id` com KPIs, histórico de pagamentos e timeline de planos.
3. `/payments` — tabela com filtros (mês, aluno, plano, método, status), modal de criação/edição, ações em massa.
4. `/analytics` — 5 seções: Receita (ano vs ano), Alunos (entradas/saídas/retenção), LTV (média, histograma, top 10, por plano), Planos (stacked bar, área, tabela), Formas de Pagamento (pie + tendência).
5. `/plans` — grid de cards, modal de criação, contagem de alunos/receita por plano.
6. `/import-export` — Wizard de importação (Upload → Mapear colunas → Preview → Confirmar) com auto-detecção de colunas e relatório de erros; exportação Excel/CSV com SheetJS.
7. `/settings` — perfil, nome da academia, mês fiscal inicial.

## Fase 5 — Componentes reutilizáveis

`KPICard`, `PaymentStatusBadge`, `StudentStatusBadge`, `PlanBadge`, `MonthYearPicker`, `DataTable`, `ImportWizard`, `EmptyState`, `LoadingSkeleton`, `ConfirmDialog`, `CurrencyInput`, `StudentSelect` (combobox com busca).

## Fase 6 — Lógica de métricas

Hooks com TanStack Query:
- `useKpis(month)` — receita, ticket médio, alunos ativos, churn.
- `useRevenueByMonth(year)` — série temporal.
- `useStudentFlow(year)` — entradas/saídas/retenção.
- `useLtv()` — agregação por aluno.
- `useByPlan(period)`, `useByPaymentMethod(period)`.

Definições exatas conforme spec (churn = pagou mês anterior mas não no atual; entrada = primeiro pagamento no mês; LTV = soma vitalícia).

## Fase 7 — Formatação

Helpers `formatBRL`, `formatDateBR`, `formatMonthBR` usando `Intl` e `date-fns/locale/pt-BR`.

## Tech notes

- **Server functions** (`createServerFn` + `requireSupabaseAuth`) para todas as leituras/escritas. Sem Edge Functions.
- **Import/Export** rodam no cliente (SheetJS/PapaParse) para evitar limites de payload.
- **Charts** com `ResponsiveContainer`, tooltips formatadas em BRL, eixos em pt-BR, skeletons durante loading.
- **SEO/meta** por rota com `head()`.
- Sitemap + robots.txt no final.

## Entregáveis por turno

Dado o tamanho, vou construir em ondas:
1. Cloud + design system + deps + auth + layout + DB.
2. Dashboard + Students + Payments + Plans (CRUD e gráficos básicos).
3. Analytics completo + Import/Export + Settings + seed + polimento.

Posso iniciar?

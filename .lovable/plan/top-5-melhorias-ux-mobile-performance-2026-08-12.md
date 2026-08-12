# Top 5 melhorias — UX/Mobile & Performance

Priorizado por impacto vs. esforço, focado nas duas áreas escolhidas.

---

## 1. Diálogos e formulários realmente usáveis no mobile

**Sintoma:** vários `DialogContent` (PT, pagamentos, planos, alunos, despesas) estouram a viewport, obrigam zoom-out e cortam botões de ação.

**O que fazer:**
- Padrão único de diálogo: `max-w-[calc(100vw-1rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6`, sem larguras fixas em px.
- Footer de ações sticky no mobile (`sticky bottom-0 bg-background border-t`) para "Salvar/Cancelar" sempre visíveis.
- Inputs numéricos com `inputMode="decimal"` e datas com `type="date"` nativos.
- Aplicar em: `StudentDialog`, `PTStudentDialog`, `PTPaymentDialog`, `PTPlanDialog`, `PaymentDialog`, `PlanDialog`, `ExpenseDialog`, `FreezeDialog`, `TransferPaymentDialog`, `BulkStudentEditDialog`, `AddExerciseDialog`, `LoadProgressionDialog`.

---

## 2. Layout responsivo das listas e cabeçalhos

**Sintoma:** cabeçalhos com avatar + nome + widgets quebram feio no mobile; tabelas de pagamentos/alunos forçam scroll horizontal do body inteiro.

**O que fazer:**
- Cabeçalhos: `grid grid-cols-[minmax(0,1fr)_auto] sm:flex`, textos com `min-w-0 truncate`, ícones com `shrink-0`.
- Tabelas densas (pagamentos, alunos, PT students) envoltas em `overflow-x-auto` local, nunca deixando o body crescer.
- Nas listagens principais (`students`, `payments`, `personal-trainer/index`), adicionar **modo card** no mobile (`sm:hidden`) e manter tabela só em `sm:` para cima.
- Meta viewport em `__root.tsx`: `width=device-width, initial-scale=1, viewport-fit=cover` (sem `maximum-scale`).

---

## 3. Tipografia escalável + preferência de tamanho

**Sintoma:** fontes pequenas demais no celular; usuários mais velhos reclamam.

**O que fazer:**
- Base tipográfica em `src/styles.css`: `html { font-size: 16px }` desktop, `17px` em `<640px`.
- Ativar o hook `useFontSize` já existente no `RootComponent` (aplica classe/`font-size` no `<html>`).
- Adicionar seletor "Tamanho da fonte" em `settings.tsx`: Pequeno/Padrão/Grande/Extra grande, persistido em `localStorage`.
- Alvos mínimos de toque 44×44 em botões `size="icon"` primários (`min-h-11 min-w-11`).

---

## 4. Performance de dados: cortar refetches e overfetch

**Sintoma:** dashboards de Studio e PT refazem várias queries a cada navegação; payloads trazem colunas que a UI não usa; imagens de exercícios sem otimização.

**O que fazer:**
- Padronizar TanStack Query com `staleTime` real (30–60s) nas listagens de alunos, planos, pagamentos, PT students, exercícios — hoje muitos usam default 0.
- Migrar cargas principais para o padrão canônico **loader + `ensureQueryData` + `useSuspenseQuery`** nas rotas `_authenticated/students`, `payments`, `personal-trainer/index`, `personal-trainer/students.$id`, `portal/index`, `portal/pt/index` — elimina flashes de loading e cascatas em `useEffect`.
- `select()` explícito nas queries pesadas (evitar `select("*")` em `payments`, `students`, `pt_training_exercises`).
- Invalidação cirúrgica após mutações (`invalidateQueries({ queryKey: [...] })` específico) em vez de refetch global.
- Índices Postgres em colunas usadas nos filtros mais quentes: `payments(user_id, status, due_date)`, `pt_payments(user_id, status)`, `students(user_id, active)`, `pt_students(user_id, active)`.

---

## 5. Peso do bundle e carregamento inicial

**Sintoma:** primeira pintura lenta em 3G/4G fraco; muita coisa entra no chunk crítico.

**O que fazer:**
- Garantir que **nenhum componente de rota** é `export`ado (quebra code-splitting automático do TanStack). Auditoria rápida em `src/routes/**`.
- Lazy-load de dependências pesadas usadas só sob demanda: `pt-program-pdf` (jsPDF/html2canvas), editor rich-text de treino, `AiPrescribeDialog`, gráficos de `analytics` — via `import()` dinâmico dentro do handler que abre o recurso.
- Imagens de exercícios (`ExerciseMediaUpload`): servir via transformador do Storage (`?width=…&quality=75&format=webp`), `loading="lazy"`, `decoding="async"`, wrapper com `aspect-video`.
- Ícones: garantir tree-shaking (import por nome de `lucide-react`, nunca `import * as`).
- Preload da imagem LCP da landing/portal via `head().links` da rota dona.

---

## Escopo e execução

- Fora deste plano: mudanças de regra de negócio (renovação, trancamento, portal PT) — puramente UX/perf.
- Sugestão de ordem: **1 → 2 → 3** (ganhos visíveis imediatos no mobile), depois **4 → 5** (performance mensurável).
- Posso executar tudo em uma leva, ou dividir em duas entregas (mobile primeiro, performance depois). Confirma como prefere?

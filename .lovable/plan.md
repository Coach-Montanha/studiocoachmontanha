# Plano de melhorias

Seis itens agrupados em três frentes: mobile (viewport, fontes, diálogos), portal do aluno de Personal Trainer, e regra de vencimento de pagamentos PT.

## 1. Viewport mobile correto (sem exigir zoom-out)

- Atualizar a meta viewport em `src/routes/__root.tsx` para:
  `width=device-width, initial-scale=1, viewport-fit=cover` (sem `maximum-scale`/`user-scalable=no`, mantendo zoom manual).
- Auditar containers que forçam largura maior que a tela (tabelas, grids). Onde houver overflow horizontal legítimo (tabelas densas), envolver em `overflow-x-auto` para não expandir o body.

## 2. Fontes maiores no mobile + preferência de tamanho

- Aumentar a escala base tipográfica no mobile via `src/styles.css`:
  - `html { font-size: 16px }` no desktop, `17px` em telas < 640px (via `@media`).
  - Ajustar utilitários responsivos de headings em componentes-chave (KPI, cards de dashboard) para não cair abaixo de `text-sm` no mobile.
- Adicionar preferência "Tamanho da fonte" em **Configurações** (`src/routes/_authenticated/settings.tsx`):
  - Opções: Pequeno (15px), Padrão (17px), Grande (19px), Extra grande (21px).
  - Persistir em `localStorage` (`ef.fontSize`) e aplicar em `<html>` via um hook `useFontSize` chamado no root.

## 3. Diálogos que estouram a tela no mobile

Corrigir o `DialogContent` para nunca ultrapassar a viewport:

- `src/components/edufinance/StudentDialog.tsx` — editar aluno.
- `src/components/pt/PTPaymentDialog.tsx` — editar pagamento PT (aparece com zoom-in).
- Aplicar padrão consistente: `max-w-[calc(100vw-1rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6`, remover larguras fixas em px.
- Revisar outros diálogos grandes (`PTStudentDialog`, `PTPlanDialog`, `PaymentDialog`, `PlanDialog`, `ExpenseDialog`) e aplicar a mesma correção.

## 4. Portal do aluno de Personal Trainer

Hoje o portal (`/portal`) atende alunos de Studio. Precisamos que alunos vinculados a `pt_students` também acessem.

Escopo:

- **Autenticação/vinculação**: reaproveitar o fluxo existente de `students.account_user_id` criando o equivalente para `pt_students` (`account_user_id`, `temp_password`, `email`). Nova server function `createPTStudentAccount` espelhando `createStudentAccount`.
- **Botão "Criar acesso"** na página do aluno PT (`personal-trainer/students.$id.tsx`).
- **Detecção do tipo de aluno no portal**: no `PortalShell`, consultar se o `auth.uid()` corresponde a um `pt_students.account_user_id`; se sim, renderizar o portal PT em vez do de Studio.
- **Novas rotas do portal PT** (sob `_authenticated/portal/pt/`):
  - `index.tsx` — visão geral: nome, plano atual, sessões restantes, próximo vencimento.
  - `treino.tsx` — aba "Meu treino": exibe o campo de treino/observações do aluno PT (usa um novo campo `training_plan` em `pt_students`, texto rico simples/markdown). Editável apenas pelo trainer no dashboard PT.
- **Migração**: adicionar coluna `training_plan text` em `pt_students` e políticas RLS para o próprio aluno ler sua linha via `account_user_id = auth.uid()`.

## 5. Regra de vencimento de pagamentos PT

Alterar cálculo de `due_date` em `PTPaymentDialog` e em `personal-trainer/index.tsx` (banner e coluna "Vencimento"):

- Plano **mensal** (`billing_type = 'monthly'`): `due_date = payment_date + 30 dias`.
- Plano **por aula/pacote** (`per_session` / `package`): vencimento é dinâmico — vence quando `sessões usadas >= sessões contratadas`. Exibir "Vence ao esgotar (X de Y usadas)" e destacar em vermelho quando restar 0.
- Ajustar geração automática de `due_date` ao inserir/editar pagamento conforme `pt_plans.billing_type`.

## Detalhes técnicos

- Meta viewport em `src/routes/__root.tsx` (função `head()`).
- Hook `useFontSize` em `src/hooks/use-font-size.ts`, chamado dentro do `RootComponent`.
- Nova server function `src/lib/pt-student-access.functions.ts` seguindo o mesmo padrão de `student-access.functions.ts` (usa `requireSupabaseAuth` + `supabaseAdmin` dinâmico).
- Migração SQL nova para `pt_students.training_plan`, `pt_students.account_user_id`, `pt_students.temp_password`, `pt_students.email` (se faltarem), com `GRANT` e políticas RLS de leitura pelo próprio aluno.
- Router: novas rotas `src/routes/_authenticated/portal/pt/index.tsx` e `.../treino.tsx`; no `PortalShell`, redirecionar para `/portal/pt` quando o usuário for detectado como aluno PT.

Confirma que posso seguir com todos os 6 itens neste plano, ou prefere que eu implemente em etapas (ex.: primeiro mobile/diálogos, depois portal PT, depois regra de vencimento)?

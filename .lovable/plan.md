# Módulo de Turmas + Portal do Aluno

Reorganiza o app em 3 módulos e adiciona login para alunos do Studio.

## Módulos (menu lateral)

```
🎓 Studio            → gestão de alunos, planos, pagamentos, contratos
💪 Personal Trainer  → já existente
📅 Turmas            → NOVO — agenda semanal, turmas, inscrições
💼 Financeiro        → já existente
⚙️  Configurações
```

Um seletor de perfil no topo alterna entre **Admin** e **Aluno** (para quem for aluno logado, entra direto no portal).

## Papéis e acesso

- Nova tabela `user_roles` com enum `app_role` = `admin | student`.
- Função `has_role()` (SECURITY DEFINER) usada em todas as policies.
- Admin cria o acesso do aluno pelo painel: gera email/senha temporária (Auth Admin API) e vincula `students.user_id` = `auth.users.id`. Aluno troca senha no primeiro login.
- Aluno logado só enxerga suas próprias linhas via RLS (`students.user_id = auth.uid()` e joins pelos IDs relacionados).

## Turmas — modelo de dados

- `classes` — turma "template": nome, treinador, dia_semana (0-6), horário, duração, capacidade, ativo, recorrente (bool).
- `class_sessions` — ocorrência real (data específica). Geradas automaticamente das recorrentes + inseridas avulsas.
- `class_enrollments` — matrícula fixa do aluno em uma turma recorrente.
- `class_attendance` — presença por sessão (registrada pelo admin).

Vagas disponíveis = capacidade − matrículas ativas (para turma recorrente) ou − check-ins confirmados (para sessão avulsa).

## Telas — Admin

**/turmas** (agenda semanal):
- Grid 7 colunas (Dom→Sáb), cards das turmas em cada dia com horário, treinador e vagas (X/Y).
- Clicar no card → drawer com: dia, horário, treinador, vagas, lista de alunos matriculados, botão adicionar/remover aluno, botão registrar presença da próxima sessão.
- Botão "Nova turma" (recorrente ou avulsa).

**/turmas/nova** e edição via dialog:
- Recorrente: dias da semana + horário → gera `class_sessions` para as próximas 12 semanas.
- Avulsa: data específica única.

## Telas — Aluno (portal)

Layout separado (`/portal/*`), sem sidebar de admin.

- **/portal** — dashboard: plano ativo, próximo vencimento, próximas 3 aulas.
- **/portal/perfil** — dados pessoais (só leitura + trocar senha).
- **/portal/plano** — plano atual, valor, vencimento, histórico de planos.
- **/portal/pagamentos** — lista com status pago/pendente.
- **/portal/turmas** — 2 abas:
  - "Minhas turmas": em que está matriculado, com próximas sessões.
  - "Disponíveis": turmas com vagas, botão inscrever / cancelar (respeita capacidade).

## Fluxo técnico

1. Migration cria: enum `app_role`, `user_roles`, função `has_role`, coluna `students.user_id`, tabelas `classes`, `class_sessions`, `class_enrollments`, `class_attendance`, todas com RLS + GRANT.
2. Server functions:
   - `createStudentAccount` (admin) — cria user via Admin API, vincula ao `students.id`, atribui role `student`.
   - `generateClassSessions` — expande turma recorrente em ocorrências.
3. Roteamento:
   - Layout `_authenticated/` decide entre `AppShell` (admin) e `PortalShell` (aluno) baseado no role.
   - Rotas admin: `/turmas`, `/turmas/$id`.
   - Rotas aluno: `/portal/*`.
4. Sidebar reorganizada em seções (Studio / Personal Trainer / Turmas / Financeiro).

## Fora do escopo

- Notificações automáticas (email/push) de aula.
- Aluno editando os próprios dados (só leitura + senha).
- Turmas misturando alunos de PT e Studio.
- Pagamento online no portal do aluno.

## Entrega sugerida em 2 partes

**Parte A** (esta): banco, roles, criação de acesso do aluno, tela `/turmas` (agenda semanal + CRUD de turmas + matrículas), portal do aluno completo.

**Parte B** (depois, se quiser): check-in de presença por sessão, relatórios de frequência, notificações.

Confirma que posso seguir com **Parte A completa** de uma vez, ou prefere quebrar em etapas menores (ex: só banco + roles primeiro, depois telas)?

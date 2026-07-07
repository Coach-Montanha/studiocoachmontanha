# Módulo de Turmas — evolução

Escopo do que vamos entregar, dividido por capacidade.

## 1. Aulas em vários dias da semana

Hoje uma turma tem apenas 1 dia (`day_of_week`). Vamos permitir marcar várias combinações (ex: **Segundas e Quintas às 8h**) numa mesma turma, sem duplicar cadastros.

- No cadastro da turma: chips clicáveis Dom · Seg · Ter · Qua · Qui · Sex · Sáb (multi-seleção) + horário único.
- A geração automática de sessões (`class_sessions`) passa a criar ocorrências para **todos** os dias marcados, nas próximas semanas.

## 2. Janela de check-in configurável

Cada turma passa a ter dois campos:
- **Abre check-in**: X minutos **antes** do início (ex: 60 min).
- **Fecha check-in / cancelamento**: Y minutos **antes** (ou depois) do início (ex: 15 min antes).

O aluno só consegue confirmar presença ou desmarcar dentro dessa janela. Fora dela, o botão aparece desabilitado com o motivo ("Check-in abre às 07:00" / "Check-in encerrado às 07:45").

Configurável na tela da turma; valores padrão sugeridos globalmente em Configurações.

## 3. Planos com cota de check-ins por período

Ampliamos a tabela `plans` com:
- **Tipo de cota**: `weekly` (por semana), `monthly` (por mês) ou `package` (pacote de N aulas com validade em dias).
- **Quantidade de check-ins** incluídos.
- **Validade em dias** (usado por `package`, ex: pacote 8 aulas / 60 dias).

Ao atribuir um plano ao aluno (`student_plan_history`), o sistema passa a contar automaticamente:

- **Semanal / mensal**: reinicia a contagem a cada segunda-feira / a cada 1º do mês.
- **Pacote**: consome 1 saldo por check-in confirmado; expira em N dias a partir do início do plano.

Regra de bloqueio: se o aluno já usou toda a cota do período vigente, novos check-ins são recusados com mensagem clara ("Cota semanal de 2 check-ins já atingida").

O saldo/uso fica visível para o aluno no portal e para o admin na ficha do aluno.

## 4. Limite de 1 check-in por dia por programa

Uma turma pode pertencer a um **programa** (ex: "Muay Thai", "Funcional"). Adicionamos uma tabela `programs` (nome + cor) e uma coluna `program_id` em `classes`.

Regra: um aluno só pode fazer **1 check-in por dia dentro do mesmo programa**. Programas diferentes no mesmo dia são permitidos.

Interruptor global (por studio) em Configurações: **"Permitir múltiplos check-ins por dia no mesmo programa"**. Quando ligado, a regra é ignorada.

## 5. Agenda visível (admin e aluno)

Nova aba **Agenda** dentro de Turmas:
- Visão semanal (padrão) e opção de lista.
- Setas para dias anteriores / próximos.
- Cada card de sessão mostra: nome da turma, programa (com cor), horário, instrutor, capacidade (ocupada/total) e status do próprio check-in do usuário.
- Filtros por programa e por instrutor.

O aluno vê no portal a mesma agenda, limitada às turmas que estão inscritos (ou todas ativas do studio, conforme sua preferência — pergunto no fim).

---

## Detalhes técnicos (para referência)

### Alterações de schema

- `classes`:
  - `days_of_week smallint[]` (substitui `day_of_week`; migração converte o valor antigo para array).
  - `checkin_opens_minutes_before int NOT NULL DEFAULT 60`
  - `checkin_closes_minutes_before int NOT NULL DEFAULT 15`
  - `program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL`
- Nova tabela `programs` (id, user_id, name, color, is_active) com RLS por dono + leitura por alunos do studio.
- `plans`:
  - `checkin_quota_type text CHECK IN ('none','weekly','monthly','package') DEFAULT 'none'`
  - `checkin_quota_amount int` (nº de check-ins do período/pacote)
  - `package_valid_days int` (só para `package`)
- Nova tabela `studio_settings` (user_id PK, `allow_multi_checkin_same_program_per_day boolean DEFAULT false`, campos default de janela de check-in).
- View / função `student_checkin_usage(student_id, at_date)` retornando quanto o aluno já usou no período vigente do seu plano ativo.

### Backend (server functions)

- `generateClassSessions` (atualizada): itera sobre todos os `days_of_week`.
- `studentCheckIn({ sessionId })` (nova): valida janela, valida cota do plano, valida limite por programa/dia, respeitando o toggle. Retorna motivo em caso de recusa.
- `studentCancelCheckIn({ sessionId })`: respeita a mesma janela.
- `getAgenda({ from, to, programId? })`: lista sessões + status do usuário.

### Frontend

- `ClassDialog`: chips multi-dia, campos de janela, seletor de programa.
- Nova página `Programas` (CRUD simples).
- `PlanDialog`: novos campos de cota e validade.
- Nova aba **Agenda** em Turmas (admin) e nova página **Agenda** no portal do aluno.
- Botão de check-in no card da sessão (portal) com feedback dinâmico da regra que impede.

### Migração de dados existentes

- `day_of_week` → `days_of_week = ARRAY[day_of_week]`.
- Planos existentes ficam com `checkin_quota_type = 'none'` (sem limite), preservando comportamento atual.

---

## Preciso de 2 confirmações antes de codar

1. **Alunos veem só as turmas em que estão inscritos, ou toda a agenda ativa do studio?**
   (Sugestão: toda a agenda, e o botão de check-in só aparece quando ele está inscrito.)

2. **O check-in é livre dentro da capacidade, ou o aluno precisa estar inscrito na turma para poder marcar?**
   (Sugestão: precisa estar inscrito; a inscrição é o vínculo que também aparece na sua lista pessoal.)

Confirma essas duas escolhas (ou me diz o que prefere) e eu implemento tudo.

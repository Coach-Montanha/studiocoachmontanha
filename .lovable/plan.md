# Plano: Aniversariantes do Mês no Dashboard

Exibir um banner de alerta no topo do Dashboard com os aniversariantes do mês (Studio e PT) e atalho para WhatsApp.

## Alterações Técnicas

### 1. Componente de Banner de Aniversariantes
- Criar `src/components/edufinance/BirthdayBanner.tsx`.
- O banner deve ser um `Alert` ou um container estilizado com fundo azul suave (tokens `bg-primary/10`).
- Exibir lista horizontal de nomes com ícones de bolo e botão de WhatsApp.
- Diferenciar visualmente (ex: badge pequena) se o aluno é "Studio" ou "PT".

### 2. Dashboard (`src/routes/_authenticated/index.tsx`)
- Integrar o `BirthdayBanner` logo após o `PageHeader` ou no topo da `main`.
- Já existe uma query `birthdayStudents` no arquivo, mas ela parece buscar apenas alunos de Studio (tabela `students`).
- Atualizar a lógica para buscar também da tabela `pt_students`.
- Agrupar os dados e passar para o banner.

### 3. Integração de Dados
- Criar ou atualizar queries para buscar aniversariantes do mês atual de ambas as tabelas.
- Garantir que o `scopeId` seja respeitado para filtrar por treinador/admin.

## Detalhes Visuais
- Cores: `bg-primary/5 border-primary/20 text-primary-foreground` (adaptado ao tema).
- Ação: `window.open(`https://wa.me/${phone}?text=Parabéns!`)`.

## User Facing Details
- Exibição automática no topo do dashboard ao entrar no mês de aniversário de qualquer aluno.
- Suporte a alunos de Personal Trainer e Studio simultaneamente.

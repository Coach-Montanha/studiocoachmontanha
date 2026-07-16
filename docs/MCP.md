# Integração MCP — Studio Coach Montanha

Este app expõe um **servidor MCP (Model Context Protocol)** protegido por OAuth em:

```
https://studiocoachmontanha.lovable.app/mcp
```

Qualquer cliente MCP compatível (ChatGPT, Claude, Cursor, Codex, agentes próprios) pode se conectar. O login é feito com a **sua conta do app** — cada cliente acessa somente os seus dados (RLS continua valendo).

---

## Ferramentas disponíveis (read-only)

| Ferramenta | O que faz |
|---|---|
| `list_students` | Lista alunos do **Studio**. Filtros: `status` (`active`/`inactive`/`churned`), `search` (nome/email), `limit`. |
| `list_pt_students` | Lista alunos de **Personal Trainer**. Mesmos filtros de `list_students`. |
| `list_recent_payments` | Pagamentos recentes. `module` (`studio` ou `pt`), `status` (`paid`/`pending`/`overdue`), `limit`. |
| `financial_overview` | Resumo do mês corrente: alunos ativos, pendentes, atrasados e recebido — separado por Studio e PT. |

Todas as ferramentas são somente leitura. Nenhum cliente MCP consegue criar, editar ou apagar dados.

---

## Como conectar

### ChatGPT (Plus/Pro/Business)

1. Vá em **Settings → Connectors → Add connector → Custom MCP server**.
2. Em **Server URL**, cole:
   ```
   https://studiocoachmontanha.lovable.app/mcp
   ```
3. Clique em **Connect**. O ChatGPT abre uma janela pedindo login no app.
4. Faça login (email/senha ou Google) e clique em **Aprovar e conectar** na tela de consentimento.
5. Pronto — as 4 ferramentas aparecem na lista do conector.

### Claude (Desktop / Web)

1. Abra **Settings → Connectors → Add custom connector**.
2. Cole a URL `https://studiocoachmontanha.lovable.app/mcp`.
3. Autorize com a sua conta do Studio Coach quando o Claude abrir o navegador.

### Cursor / Codex / outros clientes

Qualquer cliente que suporte **MCP Streamable HTTP com OAuth 2.1** funciona. Basta apontar para a mesma URL `/mcp` — o cliente descobre o fluxo OAuth automaticamente via `/.well-known/oauth-protected-resource`.

---

## Exemplos de uso (linguagem natural)

Depois de conectado, você pode pedir no chat da IA:

- "Quantos alunos ativos tenho no Studio e no PT?"
- "Me mostra os pagamentos atrasados deste mês."
- "Faz um resumo financeiro de novembro."
- "Escreve um e-mail cobrando os alunos com pagamento em atraso."
- "Liste os 10 alunos PT ativos mais antigos."
- "Compara receita paga vs. pendente + atrasado e me diz o risco de caixa."

A IA escolhe sozinha qual ferramenta chamar.

---

## Segurança

- **OAuth 2.1** com consentimento explícito na primeira conexão.
- **RLS (Row-Level Security)** aplicada em todas as leituras — a IA só enxerga os seus registros.
- **Somente leitura** — nenhuma ferramenta modifica dados.
- Você pode **revogar** o acesso a qualquer momento removendo o conector no cliente (ChatGPT/Claude/etc.).

---

## Ambiente de preview

Para testar em preview (antes de publicar mudanças) use:

```
https://project--69e8a911-c73d-4b50-a7e4-fcc5a1be4536-dev.lovable.app/mcp
```

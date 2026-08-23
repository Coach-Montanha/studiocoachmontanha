# Plano de Implementação: Novo Tema Visual "Pulse"

Criação de um sistema de temas extensível e implementação do novo tema visual "Pulse", focado em uma estética moderna com cores vibrantes e bordas arredondadas, sem alterar a lógica de negócio ou componentes existentes.

## Alterações

### 1. Infraestrutura de Temas (Extensibilidade)
- **CSS Global (`src/styles.css`)**: Definição do bloco `[data-tema="pulse"]` com novos tokens HSL/OKLCH para cores, raios de borda e tipografia.
- **Hook de Tema (`src/hooks/use-theme.ts`)**: Atualização para suportar `visualTheme` ("padrao" ou "pulse"), persistindo no `localStorage` e aplicando o atributo `data-tema` no `<html>`.
- **Root Component (`src/routes/__root.tsx`)**: Injeção de script de bloqueio de flash (inline script) para aplicar o tema antes da hidratação do React.

### 2. Design Tokens "Pulse"
- **Cores**: Fundo quase preto (#0A0A0C), Cards #18181C, Acento Laranja Vibrante (#FF6B00), Texto F5F5F5.
- **Formas**: `radius-card` aumentado para 32px, botões e badges em formato "pílula" (full radius).
- **Tipografia**: Destaque em números bold/black com tracking reduzido e labels uppercase discretas.

### 3. Interface de Seleção
- **Configurações (`src/routes/_authenticated/settings.tsx`)**: Nova seção "Aparência" com cartões interativos para trocar entre o tema "Padrão" e "Pulse", com preview das cores principais.

### 4. Ajustes em Componentes Base (via Variáveis CSS)
- **Cards (`src/components/ui/card.tsx`)**: Adaptação para usar `var(--radius-card)` dinâmico.
- **Botões/Badges**: Ajuste de `rounded-full` condicionado ao tema ativo via CSS.
- **Avatar**: Adição de anel sutil na cor primary no tema Pulse.

## Detalhes Técnicos

- **Sem Duplicação**: Não serão criados novos componentes React. A mudança é 100% via CSS Variables aplicadas ao seletor `[data-tema="pulse"]`.
- **Persistência**: O tema será salvo em `localStorage` para carregamento instantâneo.
- **Gráficos**: A cor `--primary` será herdada pelos gráficos existentes (Recharts) automaticamente, pois eles já utilizam os tokens do Tailwind.
- **Retrocompatibilidade**: O tema "padrao" permanece intocado e funciona exatamente como antes.

```css
/* Exemplo de implementação no styles.css */
[data-tema="pulse"] {
  --background: #0A0A0C;
  --card: #18181C;
  --primary: #FF6B00;
  --radius: 32px;
  /* ... outros tokens */
}
```

## Verificação
1. Validar que a troca de tema nas configurações reflete instantaneamente.
2. Confirmar que não há "flash" de tema branco ao recarregar a página no tema Pulse.
3. Verificar se cards e botões assumiram o novo raio de borda.
4. Garantir que o modo Dark/Light tradicional continua funcionando sobre o tema Pulse se necessário (ou se o Pulse é apenas Dark por design).

import { useState } from "react";
import { Check, Copy, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui-kit/SectionCard";

/**
 * Prompt pronto para copiar e colar no projeto de origem
 * (Sistema Híbrido de Treinamento), replicando lá o mesmo formato de
 * produção drag-and-drop de treinos e do editor de imagem.
 */
const DND_PROMPT = `Quero replicar neste projeto o mesmo formato de produção drag-and-drop
de treinos e de imagens que já uso no meu outro sistema. Antes de codar,
leia o projeto e ADAPTE tudo ao modelo de dados, nomes de tabelas, campos
e componentes que ele JÁ usa — não invente estrutura nova, não crie
backend novo, não faça migração se não for estritamente necessário.

PARTE A — Reordenação drag-and-drop
- Dias/semanas de treino e exercícios dentro de cada dia passam a ser
  reordenáveis arrastando (use @dnd-kit/core + @dnd-kit/sortable).
- Handle de arraste visível e sempre acessível por teclado
  (setas para mover, Espaço/Enter para pegar e soltar, anúncio via aria-live).
- Enquanto arrasta: item levantado com sombra e leve escala, alvo com
  linha/realce de destino. Nada de layout "pulando".
- Persistência: grave a nova ordem no mesmo campo de ordenação que o
  projeto já usa (order/position/sort_index). Atualização otimista com
  rollback e toast de erro se a gravação falhar.

PARTE B — Editor de layout da imagem do programa
- Um editor de canvas em grade de 12 colunas onde cada bloco do programa
  (cabeçalho, período/nível, objetivos, cada dia de treino, observações,
  assinatura) pode ser posicionado e redimensionado arrastando.
- Snap à grade, sem sobreposição (empurra ou bloqueia), clamp nas bordas.
- Formatos de saída selecionáveis: 1:1 (feed), 4:5 (post), 9:16 (story)
  e A4 (ficha para impressão), cada um com sua altura de grade.
- Presets prontos: Compacto, Cartaz e Ficha A4 — aplicáveis em um clique.
- Preview ao vivo lado a lado e aviso claro quando o conteúdo estoura o
  bloco ("texto não cabe neste tamanho").
- Persistência do layout por programa: use o que o projeto já tiver; se
  não houver lugar natural, use localStorage por id de programa. Não crie
  tabela nova só para isso.

PARTE C — Exportação
- Renderize a peça final em canvas de alta densidade (devicePixelRatio 2–3)
  e exporte em PNG e PDF.
- As cores e a tipografia do render devem ser lidas dos tokens de tema do
  projeto (não hardcode hex no renderer).
- Botão de exportar com estado de loading e toast de sucesso/erro.

DESIGN SYSTEM (obrigatório)
- Cores como tokens HSL no index.css e tudo referenciado por tokens
  semânticos do Tailwind. Proibido text-white, bg-black ou hex direto —
  dark mode tem que funcionar de graça.
- Hierarquia tipográfica clara (tamanho, peso e line-height guiando o olho).
- Respiro consistente na escala de 4/8px, alinhamento impecável.
- shadcn como base, mas com variantes customizadas — personalidade própria,
  sem cara de template.
- Mobile-first de verdade: no toque, o arraste usa handle dedicado para não
  brigar com o scroll; o editor de layout ganha versão simplificada.
- Todos os estados cobertos: hover, focus visível, active, disabled e
  loading, com transições de 150–250ms.
- Contraste acessível. Cara de produto, não de protótipo.

ESCOPO
- Proporcional ao pedido: sem over-engineering, sem rota nova
  desnecessária, sem serviço externo. Só o que faz sentido para o que
  está descrito acima.`;

export function DragDropPromptCard() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(DND_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  return (
    <SectionCard
      icon={LayoutTemplate}
      title="Prompt: drag-and-drop no projeto de origem"
      description="Copie e cole no chat do Sistema Híbrido de Treinamento"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="w-full transition-ui active:scale-[0.98] sm:w-auto"
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4 text-state-paid" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copiar prompt
            </>
          )}
        </Button>
      }
    >
      <div className="space-y-4">
        <pre className="text-caption max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 font-mono leading-relaxed text-foreground">
          {DND_PROMPT}
        </pre>
        <p className="text-caption leading-relaxed text-muted-foreground">
          O prompt pede que o outro projeto{" "}
          <strong className="font-medium text-foreground">adapte ao modelo de dados dele</strong> —
          reordenação de dias e exercícios, editor de layout em grade e exportação PNG/PDF — sem
          criar backend ou estrutura extra.
        </p>
      </div>
    </SectionCard>
  );
}

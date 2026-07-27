import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui-kit/SectionCard";

/**
 * Prompt pronto para copiar e colar no projeto de origem, replicando lá o
 * mesmo motor de "Prescrever com IA" usado aqui (contexto do banco → JSON
 * estrito → prévia revisável → gravação em duas tabelas).
 */
const AI_ENGINE_PROMPT = `Quero implementar um motor de "Prescrever com IA" para geração de treinos, no
mesmo padrão que já uso em outro projeto. Adapte ao meu schema e às minhas
convenções atuais — não crie tabelas novas nem backend extra se o que já existe
resolver.

ARQUITETURA (2 peças, nada além disso)

1) Função de servidor autenticada \`prescribeTrainingWithAi\`
   - Autenticação obrigatória; use o cliente do banco com RLS do próprio usuário.
   - Entrada validada com Zod: { programId: uuid, prompt: string 3..4000 }.
   - Busque no banco a rotina/programa desse id e extraia o contexto:
     nome, categoria, nível, tipo de nomenclatura dos dias (numérico "Dia 1/2/3"
     ou alfabético "Dia A/B/C"), período (início/fim) e objetivos.
     Esse contexto é injetado automaticamente — o usuário não deve repetir isso.
   - Chame o Lovable AI Gateway:
       POST https://ai.gateway.lovable.dev/v1/chat/completions
       headers: { "Content-Type": "application/json",
                  "Lovable-API-Key": process.env.LOVABLE_API_KEY }
       body: { model: "google/gemini-3-flash-preview",
               messages: [system, user],
               response_format: { type: "json_object" } }
   - SYSTEM PROMPT (use praticamente isto, em pt-BR):
       "Você é um Personal Trainer experiente. Gere uma prescrição de treino em
        português (Brasil). Responda APENAS com JSON válido, sem markdown, no
        formato:
        {
          "days": [
            { "name": "Treino 1",
              "day_label": "Dia A",
              "description": "Foco muscular / observações gerais",
              "exercises": [
                { "name": "Supino reto", "sets_reps": "4x10", "load": "60kg",
                  "rest_seconds": 90, "observations": "Cadência 2:1" }
              ] }
          ],
          "notes": "Observações finais do plano"
        }
        Regras: 4 a 8 exercícios por dia; 'load' e 'observations' podem ser
        vazios; 'day_label' segue o tipo de nomenclatura da rotina."
   - USER PROMPT: contexto da rotina (nome, categoria, nível, tipo, período,
     objetivos) + as instruções livres digitadas pelo usuário.
   - Tratamento de erro amigável: 429 -> "Limite de uso da IA atingido, tente em
     instantes"; 402 -> "Créditos da IA esgotados"; demais -> falha genérica com
     o status. JSON.parse defensivo com mensagem clara; garanta days como array.
   - A função NÃO escreve nada no banco: apenas retorna o JSON.

2) Diálogo "Prescrever com IA" no editor da rotina
   - Textarea de instruções (placeholder com exemplo real de divisão A/B/C/D,
     foco muscular, séries e repetições) + microcopy dizendo que a IA já usa
     categoria, nível e objetivos da rotina.
   - Botão "Gerar prescrição" com estado de loading (spinner + label mutável).
   - PRÉVIA revisável do resultado: cada dia como card com nome, badge do
     day_label, descrição e lista de exercícios mostrando
     "séries/reps · carga · descanso" e observações em linha secundária;
     bloco de notas finais em destaque sutil.
   - Só o botão "Adicionar treinos à rotina" persiste:
       para cada dia -> insert no equivalente a training_days com sort_order
       incremental a partir do fim da lista; com o id retornado, insert em lote
       dos exercícios com sort_order sequencial;
       ao final, grave no programa o prompt usado e o timestamp de geração
       (ex.: ai_prompt / ai_generated_at) para rastrear proveniência e permitir
       exibir depois o prompt que originou o treino.
   - Invalide os caches de listagem, feche o diálogo e limpe o estado.

DESIGN SYSTEM (obrigatório)
- Cores só como tokens HSL no CSS global, referenciadas pelos tokens semânticos
  do Tailwind. Nada de text-white, bg-black ou hex chumbado — dark mode tem que
  funcionar de graça.
- Hierarquia tipográfica clara (tamanho, peso, line-height), espaçamento em
  escala de 4/8px, alinhamento impecável.
- shadcn como base, mas com variantes customizadas — sem cara de template.
- Mobile-first de verdade: diálogo com max-height e scroll interno, botões que
  ocupam largura total no mobile.
- Todos os estados cobertos: hover, focus visível, active, disabled, loading,
  vazio e erro (toast). Transições de 150–250ms.
- Contraste acessível; nada de over-engineering: só o que o pedido exige.`;

export function AiEnginePromptCard() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(AI_ENGINE_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  return (
    <SectionCard
      icon={Sparkles}
      title="Prompt: motor de prescrição com IA"
      description="Replique o gerador de treinos por IA no projeto de origem"
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
          {AI_ENGINE_PROMPT}
        </pre>
        <p className="text-caption leading-relaxed text-muted-foreground">
          O motor tem duas peças: uma função de servidor que injeta o contexto da rotina e exige{" "}
          <strong className="font-medium text-foreground">JSON estrito</strong> do modelo, e um
          diálogo que mostra a prévia — nada é gravado antes de você aprovar.
        </p>
      </div>
    </SectionCard>
  );
}

import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listStudents from "./tools/list-students";
import listPtStudents from "./tools/list-pt-students";
import listRecentPayments from "./tools/list-recent-payments";
import financialOverview from "./tools/financial-overview";

// The OAuth issuer MUST be the direct Supabase host (mcp-js rejects the
// `.lovable.cloud` proxy). VITE_SUPABASE_PROJECT_ID is inlined by Vite at
// build time. The fallback keeps the issuer well-formed during the
// manifest-extract eval; no real token verifies against the sentinel.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "studio-coach-montanha-mcp",
  title: "Studio Coach Montanha",
  version: "0.1.0",
  instructions:
    "Ferramentas para consultar alunos (Studio e Personal Trainer), pagamentos e um resumo financeiro do usuário autenticado. Todas as leituras respeitam RLS — cada usuário só vê os próprios dados.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listStudents, listPtStudents, listRecentPayments, financialOverview],
});

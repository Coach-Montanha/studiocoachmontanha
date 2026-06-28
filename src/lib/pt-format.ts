export const ptSessionStatusLabel: Record<string, string> = {
  completed: "Realizada",
  cancelled_student: "Cancelada (aluno)",
  cancelled_trainer: "Cancelada (professor)",
  no_show: "Falta sem aviso",
};

export const ptSessionStatusEmoji: Record<string, string> = {
  completed: "✅",
  cancelled_student: "❌",
  cancelled_trainer: "❌",
  no_show: "🚫",
};

export const ptBillingTypeLabel: Record<string, string> = {
  monthly: "Mensal",
  per_session: "Por sessão",
  package: "Pacote",
};

export const ptStudentStatusLabel: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  paused: "Pausado",
  churned: "Desligado",
};

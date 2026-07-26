import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/personal-trainer/importar-treino")({
  beforeLoad: () => {
    throw redirect({ to: "/personal-trainer/biblioteca", search: { tab: "importar" } });
  },
});

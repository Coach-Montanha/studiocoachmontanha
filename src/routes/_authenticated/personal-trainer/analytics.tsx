import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/personal-trainer/analytics")({
  beforeLoad: () => {
    throw redirect({ to: "/financeiro", search: { tab: "pt" } });
  },
});

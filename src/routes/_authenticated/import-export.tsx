import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/import-export")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { tab: "dados" } });
  },
});

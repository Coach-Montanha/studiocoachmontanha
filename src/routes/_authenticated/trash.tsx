import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/trash")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { tab: "lixeira" } });
  },
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmDialogHost } from "@/lib/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useApplyFontSize } from "@/hooks/use-font-size";


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Studio Coach Montanh — Gestão Financeira de Alunos" },
      {
        name: "description",
        content:
          "Controle pagamentos, alunos e receita do seu curso ou academia com dashboards completos.",
      },
      { property: "og:title", content: "Studio Coach Montanh — Gestão Financeira de Alunos" },
      { name: "twitter:title", content: "Studio Coach Montanh — Gestão Financeira de Alunos" },
      { name: "description", content: "EduFinance is a web app for educators to manage student payments and financial data." },
      { property: "og:description", content: "EduFinance is a web app for educators to manage student payments and financial data." },
      { name: "twitter:description", content: "EduFinance is a web app for educators to manage student payments and financial data." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a1e6323a-33d0-41ff-b98a-0744e285697c/id-preview-899e1b68--69e8a911-c73d-4b50-a7e4-fcc5a1be4536.lovable.app-1782521708855.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a1e6323a-33d0-41ff-b98a-0744e285697c/id-preview-899e1b68--69e8a911-c73d-4b50-a7e4-fcc5a1be4536.lovable.app-1782521708855.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#ffffff" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "SC Montanha" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
        fetchpriority: "high",
      },

    ],

    scripts: [
      {
        children: `try{if(localStorage.getItem('edufinance.theme')==='dark'){document.documentElement.classList.add('dark')}var _fs=localStorage.getItem('edufinance.fontSize');var _map={sm:15,md:17,lg:19,xl:22};if(_fs&&_map[_fs]){document.documentElement.style.fontSize=_map[_fs]+'px'}else{document.documentElement.style.fontSize='17px'}}catch(e){}`,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Página não encontrada</p>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => {
    if (typeof window !== "undefined") {
       
      console.error("Root errorComponent:", error);
    }
    const recover = async () => {
      try {
        // Limpa modo suporte / impersonação
        localStorage.removeItem("edufinance.impersonate");
        // Limpa escopo de tenant (evita ficar preso vendo dados de outro)
        localStorage.removeItem("edufinance.tenantScope");
        localStorage.removeItem("edufinance.profileMode");
        // Encerra a sessão do Supabase (limpa todas as chaves sb-*-auth-token)
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
          .forEach((k) => localStorage.removeItem(k));
        try {
          await supabase.auth.signOut();
        } catch {
          /* ignore */
        }
      } finally {
        window.location.replace("/auth");
      }
    };
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Algo deu errado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tente novamente em alguns instantes. Se você entrou como outro treinador
            e ficou preso nesta tela, use o botão abaixo para sair e voltar ao login.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              Tentar novamente
            </button>
            <button
              onClick={recover}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Sair e voltar ao login
            </button>
          </div>
        </div>
      </div>
    );
  },

});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useApplyFontSize();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
        <ConfirmDialogHost />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

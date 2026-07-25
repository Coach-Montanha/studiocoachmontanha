export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      /* Página autônoma (fora do React/Tailwind): tokens locais + dark mode nativo. */
      :root {
        --bg: #fafbfc; --fg: #111114; --muted: #4b5563;
        --surface: #ffffff; --border: #e2e5ea; --on-primary: #ffffff;
        --shadow: 0 12px 32px -12px rgb(17 17 20 / 0.18);
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #0b0b0d; --fg: #f4f4f5; --muted: #a1a1aa;
          --surface: #141417; --border: #26262b; --on-primary: #0b0b0d;
          --shadow: 0 12px 32px -12px rgb(0 0 0 / 0.6);
        }
      }
      * { box-sizing: border-box; }
      body { font: 15px/1.6 system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--fg); display: grid; place-items: center; min-height: 100dvh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; background: var(--surface); border: 1px solid var(--border); border-radius: 1rem; box-shadow: var(--shadow); }
      h1 { font-size: 1.25rem; font-weight: 650; letter-spacing: -0.01em; line-height: 1.3; margin: 0 0 0.5rem; }
      p { color: var(--muted); margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.625rem 1rem; border-radius: 0.625rem; font: inherit; font-weight: 550; cursor: pointer; text-decoration: none; border: 1px solid transparent; transition: background-color .18s ease, border-color .18s ease, transform .18s ease; }
      a:focus-visible, button:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }
      a:active, button:active { transform: scale(.99); }
      .primary { background: var(--fg); color: var(--on-primary); }
      .primary:hover { opacity: .9; }
      .secondary { background: var(--surface); color: var(--fg); border-color: var(--border); }
      .secondary:hover { background: var(--bg); }
      @media (max-width: 420px) { .actions { flex-direction: column; } a, button { width: 100%; } }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}

export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #F4EFE4; color: #1C1A17; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; padding: 2rem; background: #EAE2D2; border: 1px solid #DDD4C1; box-shadow: 2px 2px 0 rgba(28,26,23,0.08); }
      h1 { font-family: ui-serif, Georgia, serif; font-weight: 900; letter-spacing: -0.03em; font-size: 1.75rem; margin: 0 0 0.75rem; text-transform: uppercase; }
      p { font-family: ui-monospace, Menlo, monospace; font-size: 0.6875rem; letter-spacing: 0.16em; text-transform: uppercase; color: #6F6A5E; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
      a, button { padding: 0.75rem 1.25rem; border-radius: 4px; font-family: ui-monospace, Menlo, monospace; font-size: 0.6875rem; letter-spacing: 0.16em; text-transform: uppercase; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #1C1A17; color: #F4EFE4; }
      .secondary { background: transparent; color: #1C1A17; border-color: #1C1A17; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This entry didn't load</h1>
      <p>Something went wrong on our side</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">[ Try again ]</button>
        <a class="secondary" href="/">[ Go home ]</a>
      </div>
    </div>
  </body>
</html>`;
}

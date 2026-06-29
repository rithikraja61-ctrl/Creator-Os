# Content Creator

This is a Lemma app app generated from the Vite template.

## Runtime

- App name: `creator-app`
- Pod id: `019eff5b-44e8-74e7-9dfb-55b423096755`
- API URL: `http://backend:8000`
- Auth URL: `http://localhost:3711`
- Served by host at the root of the app subdomain (base path `/`)

## Product Direction

- Build native React routes and components for the operator workflow.
- Replace sample routes, sample data, sidebar labels, fake users, placeholder metrics, and starter copy.
- Keep Lemma auth centralized through `AuthGuard`.
- Use `lemma-sdk/react` hooks and the shared `lemmaClient` from `src/lemma-client.ts`.
- Preferred style presets: neobrutal, editorial, soft, terminal.
- Current default style preset: `soft`.
- Do not use Lemma registry scaffolding in this project.

## Calling the API

- Fetch once with hooks (`useRecords`, `useDatastoreQuery`, generated `use<Resource>List`). Never call `lemmaClient.records.list(...)` during render or in a `useEffect` with unstable deps — that loops.
- Realtime = subscribe, never poll. Use `useLiveRecords` for a live list (fetches once, then merges row deltas in place over the table WebSocket) or `useWatchChanges` for custom state. Never `setInterval(refetch)` — polling flickers and hammers the API.
- Don't flicker or reload: merge changes in place keyed by `record_id`, give list rows a stable `key` (the row id), and create the client once + gate auth once with `AuthGuard`.
- Writes through the generated CRUD hooks under `QueryClientProvider` auto-refresh the matching list — don't hand-wire a refetch.

## Verification

- Run the local dev server with the package manager used by the project.
- Run `npm run build`, `pnpm run build`, or `yarn run build` before deploy.
- Deploy with `lemma apps deploy creator-app --source-dir . --yes`.

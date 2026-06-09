# Repository Guidelines

## Project Structure & Module Organization

Moonlit is a FastAPI backend plus a React/Vite frontend.

- `back-end/` contains the API server, LangGraph agent, auth, services, repositories, and database adapters. Key entry points are `main.py`, `config.py`, and `agent/graph.py`.
- `back-end/api/routes/` defines HTTP routes; `back-end/api/schemas/` holds request/response contracts.
- `back-end/database/adapters/` contains PostgreSQL, MySQL, SQL Server, and Oracle logic.
- `front-end/src/` contains the SPA. Use `api/` for client calls, `components/` for shared UI, `features/` for larger surfaces, `hooks/` for reusable React behavior, `contexts/` for providers, and `pages/` for routes.
- `front-end/public/` stores static logos and demo media.

## Build, Test, and Development Commands

Backend:

```bash
cd back-end
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

Frontend:

```bash
cd front-end
npm install
npm run dev       # start Vite at http://localhost:5173
npm run build     # create production build
npm run preview   # serve built app locally
npm run lint      # run ESLint
npm run lint:fix  # auto-fix lint issues
npm run test      # run Vitest once
npm run knip      # find unused exports/files/dependencies
```

## Coding Style & Naming Conventions

Frontend code uses ES modules, React JSX, and ESLint flat config. Prefer 2-space indentation, single quotes, named exports for shared modules, and PascalCase components (`SettingsModal.jsx`). Hooks must start with `use`. Keep API constants and validation schemas in `front-end/src/api/` or `front-end/src/utils/`.

Backend code follows Python 3.11+ conventions with snake_case modules, functions, and variables. Keep routes thin; place business logic in `services/`, persistence in `repositories/`, and database-specific behavior in adapters.

## Testing Guidelines

Frontend tests use Vitest; place tests near covered code with `*.test.js` or `*.test.jsx`. Run `npm run test` before a PR. Backend has no full test suite configured yet; add focused tests for new services or adapters, and document manual API checks.

## Commit & Pull Request Guidelines

Recent commits use short, imperative messages such as `Refactor theme structure and improve theme utility functions` and `Wire frontend to typed API contracts`. Keep subjects concise and action-oriented. PRs should include a summary, testing performed, linked issues, screenshots for UI changes, and any configuration changes.

## Security & Configuration Tips

Do not commit secrets. Backend configuration belongs in `back-end/.env`; required values include Firebase credentials, at least one LLM provider API key, Redis URLs outside development, and production CORS origins. Preserve read-only database query behavior unless a security review approves a change.

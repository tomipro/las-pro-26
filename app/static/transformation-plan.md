
## Plan: React + TS Frontend Migration

Incrementally migrate the monolithic static frontend into a Vite-based React+TypeScript app while keeping FastAPI as the API. Focus on reusable plot and card components, a clean folder structure (models, hooks, services, controllers), and a staged rollout that allows side-by-side validation.

**Steps**
1. Inventory current UI/behavior and map to component boundaries: identify plot widgets, cards, panels, tabs, and data flows in app/static (overview vs sequence). Extract a component list and shared props for plot cards, metric cards, and section shells. *Depends on code audit.*
2. Stand up Vite React+TS app under app/frontend/ with kebab-case file names and base tooling (React, TypeScript, react-plotly.js, Vitest). Add CSS Modules + a global tokens file for existing variables. *Blocks further frontend work.*
3. Establish frontend architecture and types: add models for API payloads (portfolio, analytics, well, sequence, chat), services for API calls, controllers for orchestration (analysis runs, export, sequence interactions), and hooks for state (analysis, tabs, chat, sequence). Define a central state shape and loading/error enums. *Depends on step 2.*
4. Build reusable plot and card primitives: PlotCard (title, meta, plot), MetricCard, SectionPanel, TabBar, EmptyPlot. Wrap Plotly via react-plotly.js and unify base layout/ theme from current PLOT_LAYOUT_BASE. *Parallel with step 5 after step 3.*
5. Rebuild Overview tab: portfolio summary, comparison grid (ranking, similarity, pay-risk, crossplot, SOM), AI interpretation, chat, errors, wells. Each section becomes a component tree with local hooks and shared plot primitives. *Depends on steps 3-4.*
6. Rebuild Sequence tab: sequence controls, sequence plot, boundary review list, cross-well correlation, AI sequence interpretation. Move sequenceState logic into hook + controller. *Depends on steps 3-4.*
7. Integrate exports and utilities: CSV/PDF export, markdown rendering, safe HTML (DOMPurify) moved into services/utils. Provide a unified formatter and error helpers. *Depends on steps 3-6.*
8. Wire API integration and dev server: Vite uses API base URL to FastAPI. Add CORS config in backend for local dev. Keep existing static app for incremental rollout, then add a feature flag or route switch to move traffic. *Depends on steps 2-7.*
9. Add tests: Vitest for utilities, data mappers, and any non-UI controllers; minimal component tests for critical rendering (plot empty states, metric card rendering). *Parallel with steps 5-7.*
10. Migration cutover: update FastAPI index route to serve new frontend build for production when ready, deprecate app/static assets after parity checks. *Depends on step 8.*

**Relevant files**
- index.html — source of sections and layout to map into components  
- app.js — current state management, plotting, and API calls to port  
- style.css — design tokens and base styling to migrate into CSS Modules/tokens  
- main.py — API endpoints and static hosting, add CORS and future build serving  
- app/services/* — backend payload shape source for frontend models  

**Verification**
1. Run Vite dev server + FastAPI API; verify Overview and Sequence tabs render with sample analysis.
2. Validate plot rendering and resize behavior across tab switches.
3. Exercise exports (CSV/PDF) and chat flows with and without AI toggle.
4. Run Vitest and confirm key utilities/controllers tests pass.

**Decisions**
- Incremental migration with FastAPI as API only during development.
- Keep Plotly via react-plotly.js.
- Use app/frontend/ for React app; kebab-case file names.
- Use Vitest now.

**Further Considerations**
1. Feature flag strategy for cutover: keep both frontends or switch to React-only once parity is confirmed.
2. State management choice: custom hooks vs a lightweight store (e.g., Zustand) if state grows.
3. Build/serve strategy: FastAPI serving static build vs separate hosting in production.

If this looks right, I can refine scope and sequencing or move to a handoff-ready plan.
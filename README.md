# LAS Intel POC (Multi-Well)

A localhost web app for oil & gas LAS analysis that goes beyond file reading:
- Multi-well LAS ingestion
- QC + physics-aware checks
- Petrophysical screening (Vsh, Phi, Sw)
- ML anomaly detection + electrofacies clustering
- Self-Organizing Maps (SOM) for unsupervised facies topology mapping
- AI technical interpretation (OpenAI optional; heuristic fallback included)
- Cross-well comparison analytics:
  - Well ranking
  - Facies similarity matrix
  - Pay-risk matrix
  - SOM quality comparison
- Demo mode for showcases with one-click CSV/PDF export

## Tech Stack
- Backend API: FastAPI (Python)
- Data/Science: lasio, pandas, numpy, scipy, scikit-learn
- Frontend (modern): React + TypeScript + Vite + TanStack Query + Zustand + Plotly

## Project Structure
- `app/main.py`: FastAPI app and API routes
- `app/services/las_parser.py`: LAS parsing + curve mapping
- `app/services/qc.py`: data quality and physics sanity checks
- `app/services/petrophysics.py`: Vsh/Phi/Sw and potential pay intervals
- `app/services/ml.py`: anomaly detection + electrofacies clustering
- `app/services/sequence.py`: sequence stratigraphy auto-picks + correlation
- `app/services/ai.py`: AI interpretation (with fallback)
- `app/services/analyzer.py`: orchestration and portfolio summary
- `frontend/`: React TypeScript frontend
- `app/static/`: legacy static frontend (kept for fallback)
- `LAS_Sample_API/`: provided sample LAS files

## Run Locally (Modern Frontend)
1. Create and activate a virtual environment.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Optional: enable AI interpretation with API key:
   ```bash
   cp .env.example .env
   # set GEMINI_API_KEY in .env (preferred)
   ```
4. Start backend API:
   ```bash
   uvicorn app.main:app --reload
   ```
5. In a second terminal, start frontend:
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   npm run dev
   ```
6. Open:
   - Frontend: `http://127.0.0.1:5173`
   - Backend API docs: `http://127.0.0.1:8000/docs`

## Run Locally (Legacy Fallback)
If needed, legacy static UI is still available:
```bash
./run_local.sh
```
Then open `http://127.0.0.1:8000`.

## Deploy on Render
This repo includes all required deploy files:
- `Dockerfile`
- `.dockerignore`
- `render.yaml` (Blueprint)

### Option A: Blueprint (recommended)
1. Push this repo to GitHub.
2. In Render, click `New` -> `Blueprint`.
3. Select this repo/branch.
4. Render will detect `render.yaml` and create `las-intel-poc`.
5. Set secret env var:
   - `GEMINI_API_KEY` (required for AI features)
6. Deploy.

### Option B: Manual Web Service
1. In Render, click `New` -> `Web Service`.
2. Connect this repo.
3. Set:
   - Runtime: `Docker`
   - Health check path: `/api/health`
4. Add env vars:
   - `GEMINI_API_KEY` (required)
   - `GEMINI_MODEL=gemini-3.1-flash-lite-preview` (optional override)
5. Deploy.

After deploy:
- App: `https://<your-service>.onrender.com`
- Health: `https://<your-service>.onrender.com/api/health`

## Demo Flow
1. Open the web UI.
2. Click `Launch Demo Mode`.
3. After analysis completes, click:
   - `Export PDF` for committee/company presentation output.
   - `Export CSV` for data-driven follow-up.

## Endpoints
- `GET /api/health`
- `POST /api/analyze-samples?with_ai=true|false`
- `POST /api/analyze-files?with_ai=true|false` (multipart `files`)

## Notes
- ChatGPT Plus does not include API credits automatically. API usage is separate billing.
- AI interpretation is Gemini-first (`GEMINI_API_KEY`, model default `gemini-2.5-pro`), with OpenAI as optional fallback.
- Current petrophysical equations are screening-grade defaults; calibration with field/core data is required before operational use.

## GitHub Upload Safety
1. Keep real API keys only in local `.env` (already ignored by `.gitignore`).
2. Use `.env.example` for placeholders only.
3. Before pushing, verify:
   ```bash
   git status
   git check-ignore -v .env .venv
   ```
4. If a secret was ever committed, rotate the key immediately and purge it from git history before publishing.

## Suggested Next Iterations
1. Add lithology/facies labels and supervised ML models.
2. Add depth alignment and cross-well normalization workflow.
3. Add user auth/workspace management and persisted project history.
4. Add DLIS/CSV/core-data ingestion and cross-domain joins.

# Detailed Prompt: LAS Intelligence Platform (Computer Engineering Final Project)

Use this prompt to resume the project in any new chat/session.

## Prompt
You are helping build a production-oriented **LAS Intelligence Platform** for oil and gas operations.
The project is for a **Computer Engineering final project** and should be credible enough to impress geologists, petroleum engineers, and industry stakeholders.

### Context
- Target users: geologists, petrophysicists, petroleum engineers, drilling engineers.
- Current phase: localhost POC.
- Primary input for v1: LAS files (`.las`), with multi-well support from day one.
- Existing sample data: LAS files in `LAS_Sample_API/`.
- UI language: English.
- Goal: an all-in-one solution that goes beyond simple LAS reading.

### Product Vision
Build an integrated application that can:
1. Read and understand LAS files robustly.
2. Perform physics-aware data quality control.
3. Generate petrophysical screening interpretations.
4. Apply ML/AI to detect patterns, anomalies, and facies-like groupings.
5. Produce technical summaries that explain what the model "sees".
6. Scale toward end-to-end multi-data workflows (LAS, CSV, DLIS, lab/core data) in later phases.

### v1 Must-Haves (POC)
1. **Multi-well LAS ingestion**: upload multiple LAS files and parse metadata/curves/units.
2. **QC + physics checks**:
   - depth monotonicity and step consistency
   - missing-data profile by curve
   - outlier checks
   - plausible-physics range checks (GR, DT, resistivity, etc.)
3. **Petrophysical screening**:
   - Vsh from GR index
   - porosity proxy from sonic/density when available
   - water saturation screening via Archie with explicit assumptions
   - potential pay interval flags (screening only)
4. **ML modules**:
   - anomaly detection (unsupervised)
   - electrofacies clustering (unsupervised)
5. **AI interpretation layer**:
   - technical multi-well summary
   - caveats, risks, and prioritized next steps
6. **Web interface**:
   - portfolio-level metrics
   - per-well QC + petrophysics + ML sections
   - interactive depth plots

### Tech Guidance
- Prefer modern, maintainable stack.
- Recommended baseline:
  - Backend: FastAPI (Python)
  - Science: lasio, pandas, numpy, scipy, scikit-learn
  - Frontend: web app with interactive plots
- Keep architecture modular so it can later evolve to:
  - separate frontend app (e.g., Next.js)
  - auth + workspaces
  - persistent storage
  - report generation and MLOps

### AI/ML Guidance
- Use strong classical ML first for reliability and speed in POC.
- Treat deep learning and PINNs as future phases unless a specific sub-problem clearly benefits now.
- Emphasize explainability and transparent assumptions in outputs.

### Engineering Rules
1. Never present screening equations as final reservoir truth.
2. Always show assumptions and data limitations.
3. Separate observed facts from inferred interpretations.
4. Keep model outputs auditable and reproducible.
5. Design for multi-well workflows from the beginning.

### Deliverables for Final Project Committee Demo
1. Working localhost web app.
2. End-to-end flow from raw LAS upload to interpretable outputs.
3. Multi-well comparative insights.
4. Clear evidence of engineering rigor (QC, assumptions, validation strategy).
5. Credible roadmap to production deployment.

### Roadmap After v1
1. Add supervised tasks (lithology/facies classification, porosity/permeability regression) once labeled data exists.
2. Add depth harmonization and cross-well normalization workflows.
3. Add uncertainty quantification and explainability dashboards.
4. Add report export and collaboration features.
5. Add additional data sources (CSV, DLIS, core/lab, drilling data).
6. Evaluate PINNs only for specific physics-constrained inverse problems.

### Working Style Request
- Implement practical increments.
- Keep code clean and modular.
- Provide concise rationale for technical decisions.
- At each step, include what was built, what assumptions were made, and what remains.


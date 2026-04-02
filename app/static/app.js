const fileInput = document.getElementById("fileInput");
const aiToggle = document.getElementById("aiToggle");
const demoToggle = document.getElementById("demoToggle");

const statusLine = document.getElementById("statusLine");
const analyzeSamplesBtn = document.getElementById("analyzeSamplesBtn");
const analyzeUploadBtn = document.getElementById("analyzeUploadBtn");
const demoRunBtn = document.getElementById("demoRunBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const overviewTabBtn = document.getElementById("overviewTabBtn");
const sequenceTabBtn = document.getElementById("sequenceTabBtn");
const overviewTabContent = document.getElementById("overviewTabContent");
const sequenceTabContent = document.getElementById("sequenceTabContent");

const portfolioSection = document.getElementById("portfolioSection");
const comparisonSection = document.getElementById("comparisonSection");
const aiSection = document.getElementById("aiSection");
const chatSection = document.getElementById("chatSection");
const wellsSection = document.getElementById("wellsSection");
const errorsSection = document.getElementById("errorsSection");

const portfolioCards = document.getElementById("portfolioCards");
const aiSkeleton = document.getElementById("aiSkeleton");
const aiText = document.getElementById("aiText");
const aiMeta = document.getElementById("aiMeta");
const chatMeta = document.getElementById("chatMeta");
const chatMessages = document.getElementById("chatMessages");
const chatTyping = document.getElementById("chatTyping");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const chatClearBtn = document.getElementById("chatClearBtn");
const wellCards = document.getElementById("wellCards");
const errorsList = document.getElementById("errorsList");

const rankingPlot = document.getElementById("rankingPlot");
const similarityPlot = document.getElementById("similarityPlot");
const payRiskPlot = document.getElementById("payRiskPlot");
const geoCrossPlot = document.getElementById("geoCrossPlot");
const somQualityPlot = document.getElementById("somQualityPlot");
const similarityMeta = document.getElementById("similarityMeta");
const similarityPairs = document.getElementById("similarityPairs");
const sequenceWellSelect = document.getElementById("sequenceWellSelect");
const sequenceConfidenceRange = document.getElementById("sequenceConfidenceRange");
const sequenceConfidenceValue = document.getElementById("sequenceConfidenceValue");
const sequenceAiSuggestBtn = document.getElementById("sequenceAiSuggestBtn");
const sequenceResetEditsBtn = document.getElementById("sequenceResetEditsBtn");
const sequenceStatusLine = document.getElementById("sequenceStatusLine");
const sequenceMeta = document.getElementById("sequenceMeta");
const sequencePlot = document.getElementById("sequencePlot");
const sequenceBoundaryList = document.getElementById("sequenceBoundaryList");
const sequenceManualDepthInput = document.getElementById("sequenceManualDepthInput");
const sequenceAddManualBtn = document.getElementById("sequenceAddManualBtn");
const sequenceCorrelationMeta = document.getElementById("sequenceCorrelationMeta");
const sequenceCorrelationPlot = document.getElementById("sequenceCorrelationPlot");
const sequenceAiMeta = document.getElementById("sequenceAiMeta");
const sequenceAiSkeleton = document.getElementById("sequenceAiSkeleton");
const sequenceAiText = document.getElementById("sequenceAiText");

let currentPayload = null;
let currentAnalysisId = null;
let currentRunToken = 0;
let chatHistory = [];
let isChatPending = false;
let activeTab = "overview";
let sequenceState = {
  selectedWell: null,
  threshold: 0.45,
  editsByWell: {},
};

const PLOT_LAYOUT_BASE = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(10,18,26,0.65)",
  font: { color: "#d9ecfa", family: "Space Grotesk, sans-serif" },
  margin: { l: 52, r: 24, t: 42, b: 45 },
};

function fmt(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  if (typeof value !== "number") return String(value);
  return value.toFixed(digits);
}

function setStatus(message) {
  statusLine.textContent = message;
}

function setDemoModeVisuals(enabled) {
  document.body.classList.toggle("demo-mode", enabled);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function markdownToHtml(text) {
  const source = String(text ?? "");
  if (window.marked && typeof window.marked.parse === "function" && window.DOMPurify) {
    window.marked.setOptions({
      gfm: true,
      breaks: true,
      headerIds: false,
      mangle: false,
    });
    const parsed = window.marked.parse(source);
    return window.DOMPurify.sanitize(parsed);
  }
  return `<p>${escapeHtml(source).replaceAll("\n", "<br>")}</p>`;
}

function setMarkdownContent(element, text) {
  if (!element) return;
  element.innerHTML = markdownToHtml(text);
}

function formatMeta(meta) {
  if (!meta) return "Source: N/A";
  const source = meta.source || "N/A";
  const detail = meta.model || meta.reason || "";
  return detail ? `Source: ${source} | ${detail}` : `Source: ${source}`;
}

function setAiLoading(loading) {
  aiSkeleton.classList.toggle("hidden", !loading);
  aiText.classList.toggle("hidden", loading);
  if (loading) {
    aiMeta.textContent = "Source: pending | Generating interpretation...";
    aiText.innerHTML = "";
  }
}

function setSequenceStatus(message) {
  if (sequenceStatusLine) {
    sequenceStatusLine.textContent = message;
  }
}

function setSequenceAiLoading(loading) {
  sequenceAiSkeleton.classList.toggle("hidden", !loading);
  sequenceAiText.classList.toggle("hidden", loading);
  if (loading) {
    sequenceAiMeta.textContent = "Source: pending | Generating sequence suggestions...";
    sequenceAiText.innerHTML = "";
  }
}

function setActiveTab(tabName) {
  activeTab = tabName;
  const isOverview = tabName === "overview";
  overviewTabBtn.classList.toggle("active", isOverview);
  sequenceTabBtn.classList.toggle("active", !isOverview);
  overviewTabContent.classList.toggle("hidden", !isOverview);
  sequenceTabContent.classList.toggle("hidden", isOverview);
  if (!isOverview && currentPayload) {
    renderSequenceTab();
  }
}

function renderChatMessages() {
  chatMessages.innerHTML = "";
  for (const message of chatHistory) {
    const bubble = document.createElement("div");
    bubble.className = `chat-message ${message.role || "assistant"}`;
    bubble.innerHTML = markdownToHtml(message.content);
    chatMessages.appendChild(bubble);
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setChatPending(pending) {
  isChatPending = pending;
  chatTyping.classList.toggle("hidden", !pending);
  chatSendBtn.disabled = pending || !currentAnalysisId;
  chatInput.disabled = pending || !currentAnalysisId;
}

function resetChatState() {
  chatHistory = [];
  if (currentAnalysisId) {
    chatHistory.push({
      role: "system",
      content:
        "Analysis context ready. Ask about well ranking, facies/SOM similarity, pay-risk, anomalies, QC caveats, or recommended technical next steps.",
    });
    chatMeta.textContent = `Context: ${currentAnalysisId.slice(0, 8)}... | AI ${
      aiToggle.checked ? "enabled" : "disabled"
    }`;
  } else {
    chatMeta.textContent = "No active analysis context.";
  }
  renderChatMessages();
  setChatPending(false);
}

function createMetricCard(label, value) {
  const card = document.createElement("div");
  card.className = "metric-card";
  card.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>`;
  return card;
}

function renderPortfolio(summary, densityTransform = null) {
  portfolioCards.innerHTML = "";
  portfolioCards.appendChild(createMetricCard("Wells", summary.well_count ?? "N/A"));
  portfolioCards.appendChild(createMetricCard("Avg QC", fmt(summary.avg_qc_score, 1)));
  portfolioCards.appendChild(createMetricCard("Depth Samples", summary.total_depth_points ?? "N/A"));
  portfolioCards.appendChild(createMetricCard("Wells With Potential Pay", summary.wells_with_pay ?? "N/A"));
  portfolioCards.appendChild(createMetricCard("Avg Anomaly %", fmt(summary.avg_anomaly_pct, 2)));
  portfolioCards.appendChild(createMetricCard("Density Transform", densityTransform?.method || "N/A"));
  portfolioCards.appendChild(createMetricCard("Transform Support Points", densityTransform?.support_points ?? "N/A"));
  portfolioSection.classList.remove("hidden");
}

function renderErrors(errors) {
  errorsList.innerHTML = "";
  if (!errors || !errors.length) {
    errorsSection.classList.add("hidden");
    return;
  }

  for (const err of errors) {
    const item = document.createElement("li");
    item.textContent = `${err.file_name ?? "file"}: ${err.error}`;
    errorsList.appendChild(item);
  }
  errorsSection.classList.remove("hidden");
}

function normalizeSeries(series) {
  const values = series.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!values.length) return series.map(() => null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const den = max - min || 1.0;
  return series.map((v) => (typeof v === "number" && Number.isFinite(v) ? (v - min) / den : null));
}

function numericValues(series) {
  return (series || []).filter((v) => typeof v === "number" && Number.isFinite(v));
}

function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function axisRangeFromSeries(series, lowerQ = 0.02, upperQ = 0.98) {
  const vals = numericValues(series);
  if (!vals.length) return null;
  const low = quantile(vals, lowerQ);
  const high = quantile(vals, upperQ);
  if (low === null || high === null) return null;
  if (high <= low) return [low - 1, high + 1];
  const pad = (high - low) * 0.04;
  return [low - pad, high + pad];
}

function makeTag(text, cls = "") {
  return `<span class="tag ${cls}">${text}</span>`;
}

function hasNumericData(values) {
  return Array.isArray(values) && values.some((v) => typeof v === "number" && Number.isFinite(v));
}

function renderEmptyPlot(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="plot-empty">${message}</div>`;
}

function resizeAllPlots() {
  for (const id of ["rankingPlot", "similarityPlot", "payRiskPlot", "geoCrossPlot", "somQualityPlot", "sequencePlot", "sequenceCorrelationPlot"]) {
    const el = document.getElementById(id);
    if (el && el.data) {
      Plotly.Plots.resize(el);
    }
  }
}

function renderComparison(analytics) {
  comparisonSection.classList.remove("hidden");

  const ranking = analytics?.well_ranking || [];
  const payRisk = analytics?.pay_risk_matrix || [];
  const facies = analytics?.facies_similarity || {};
  const geophysics = analytics?.geophysics_crossplot || [];
  const somQuality = analytics?.som_quality || [];

  const rankingNames = ranking.map((r) => `${r.rank}. ${r.well_name}`);
  const rankingScores = ranking.map((r) => r.composite_score);
  if (ranking.length) {
    Plotly.newPlot(
      rankingPlot,
      [
        {
          type: "bar",
          orientation: "h",
          y: rankingNames,
          x: rankingScores,
          marker: {
            color: rankingScores,
            colorscale: [
              [0.0, "#2fa7c8"],
              [0.5, "#54d1a0"],
              [1.0, "#f0c061"],
            ],
          },
          text: rankingScores.map((v) => fmt(v, 2)),
          textposition: "inside",
          hovertemplate: "%{y}<br>Composite score: %{x:.2f}<extra></extra>",
        },
      ],
      {
        ...PLOT_LAYOUT_BASE,
        margin: { l: 120, r: 24, t: 28, b: 35 },
        xaxis: { title: "Composite Score", gridcolor: "rgba(166,197,217,0.12)" },
        yaxis: { autorange: "reversed" },
      },
      { responsive: true, displaylogo: false }
    );
  } else {
    renderEmptyPlot(rankingPlot, "No ranking data available.");
  }

  const similarityLabels = facies.labels || [];
  const similarityMatrix = facies.matrix || [];
  similarityMeta.textContent = facies.value_interpretation
    ? `${facies.method || "Similarity"} | ${facies.value_interpretation}`
    : "";
  if (similarityLabels.length && similarityMatrix.length) {
    Plotly.newPlot(
      similarityPlot,
      [
        {
          type: "heatmap",
          z: similarityMatrix,
          x: similarityLabels,
          y: similarityLabels,
          zmid: 0,
          zmin: -1,
          zmax: 1,
          colorscale: [
            [0.0, "#6b1d24"],
            [0.5, "#1f3344"],
            [1.0, "#5ae0b2"],
          ],
          hovertemplate: "<b>%{x}</b> vs <b>%{y}</b><br>Similarity: %{z:.3f}<extra></extra>",
        },
      ],
      {
        ...PLOT_LAYOUT_BASE,
        margin: { l: 80, r: 24, t: 26, b: 72 },
        xaxis: { tickangle: -30 },
      },
      { responsive: true, displaylogo: false }
    );
  } else {
    renderEmptyPlot(similarityPlot, "No facies similarity data available.");
  }

  similarityPairs.innerHTML = "";
  for (const pair of facies.top_pairs || []) {
    const item = document.createElement("li");
    item.textContent = `${pair.well_a} <> ${pair.well_b}: ${fmt(pair.similarity, 3)}`;
    similarityPairs.appendChild(item);
  }

  const quadrantColors = {
    "Prime Target": "#54d1a0",
    "Balanced Opportunity": "#2fa7c8",
    "Low Upside / Low Risk": "#9bb3c4",
    "High-Risk / Needs Review": "#ff6e74",
  };

  if (payRisk.length) {
    Plotly.newPlot(
      payRiskPlot,
      [
        {
          type: "scatter",
          mode: "markers+text",
          x: payRisk.map((r) => r.risk_index),
          y: payRisk.map((r) => r.pay_index),
          text: payRisk.map((r) => r.well_name),
          textposition: "top center",
          marker: {
            size: payRisk.map((r) => Math.max(12, 18 + (r.net_reservoir_fraction || 0) * 35)),
            color: payRisk.map((r) => quadrantColors[r.quadrant] || "#2fa7c8"),
            line: { color: "#d9ecfa", width: 0.8 },
            opacity: 0.92,
          },
          customdata: payRisk.map((r) => [r.qc_score, r.anomaly_pct, r.quadrant]),
          hovertemplate:
            "%{text}<br>Pay index: %{y:.2f}<br>Risk index: %{x:.2f}" +
            "<br>QC score: %{customdata[0]:.1f}<br>Anomaly %: %{customdata[1]:.2f}" +
            "<br>Category: %{customdata[2]}<extra></extra>",
        },
      ],
      {
        ...PLOT_LAYOUT_BASE,
        margin: { l: 55, r: 24, t: 24, b: 42 },
        xaxis: { title: "Risk Index", range: [0, 100], gridcolor: "rgba(166,197,217,0.12)" },
        yaxis: { title: "Pay Index", range: [0, 100], gridcolor: "rgba(166,197,217,0.12)" },
        shapes: [
          {
            type: "line",
            x0: 40,
            x1: 40,
            y0: 0,
            y1: 100,
            line: { color: "rgba(166,197,217,0.3)", dash: "dot" },
          },
          {
            type: "line",
            x0: 0,
            x1: 100,
            y0: 60,
            y1: 60,
            line: { color: "rgba(166,197,217,0.3)", dash: "dot" },
          },
        ],
      },
      { responsive: true, displaylogo: false }
    );
  } else {
    renderEmptyPlot(payRiskPlot, "No pay-risk data available.");
  }

  if (geophysics.length && hasNumericData(geophysics.map((r) => r.avg_velocity_ft_s))) {
    Plotly.newPlot(
      geoCrossPlot,
      [
        {
          type: "scatter",
          mode: "markers+text",
          x: geophysics.map((r) => r.avg_velocity_ft_s),
          y: geophysics.map((r) => r.reflectivity_energy),
          text: geophysics.map((r) => r.well_name),
          textposition: "top center",
          marker: {
            size: geophysics.map((r) => Math.max(14, (r.pay_index || 0) * 0.35)),
            color: geophysics.map((r) => r.risk_index),
            colorscale: "Turbo",
            cmin: 0,
            cmax: 100,
            line: { color: "#d9ecfa", width: 0.8 },
            opacity: 0.9,
            colorbar: { title: "Risk" },
          },
          hovertemplate:
            "%{text}<br>Avg velocity: %{x:.1f} ft/s<br>Reflectivity energy: %{y:.5f}" +
            "<br>Pay index bubble size<extra></extra>",
        },
      ],
      {
        ...PLOT_LAYOUT_BASE,
        margin: { l: 60, r: 24, t: 24, b: 45 },
        xaxis: { title: "Average Velocity (ft/s)", gridcolor: "rgba(166,197,217,0.12)" },
        yaxis: { title: "Reflectivity Energy", gridcolor: "rgba(166,197,217,0.12)" },
      },
      { responsive: true, displaylogo: false }
    );
  } else {
    renderEmptyPlot(geoCrossPlot, "Geophysics crossplot requires DT curve data.");
  }

  if (somQuality.length && hasNumericData(somQuality.map((r) => r.quantization_error))) {
    Plotly.newPlot(
      somQualityPlot,
      [
        {
          type: "bar",
          x: somQuality.map((r) => r.well_name),
          y: somQuality.map((r) => r.quantization_error),
          name: "Quantization Error",
          marker: { color: "#f2bf58" },
          hovertemplate: "%{x}<br>QE: %{y:.4f}<extra></extra>",
        },
        {
          type: "scatter",
          x: somQuality.map((r) => r.well_name),
          y: somQuality.map((r) => r.topological_error),
          mode: "lines+markers",
          yaxis: "y2",
          name: "Topological Error",
          line: { color: "#58d1b2", width: 2 },
          marker: { size: 7 },
          hovertemplate: "%{x}<br>TE: %{y:.4f}<extra></extra>",
        },
      ],
      {
        ...PLOT_LAYOUT_BASE,
        margin: { l: 55, r: 55, t: 24, b: 64 },
        xaxis: { tickangle: -25 },
        yaxis: { title: "Quantization Error", gridcolor: "rgba(166,197,217,0.12)" },
        yaxis2: { title: "Topological Error", overlaying: "y", side: "right", showgrid: false },
        legend: { orientation: "h" },
      },
      { responsive: true, displaylogo: false }
    );
  } else {
    renderEmptyPlot(somQualityPlot, "SOM quality metrics unavailable.");
  }

  setTimeout(resizeAllPlots, 80);
}

function renderWell(well, idx) {
  const qcStatus = well.qc?.status ?? "unknown";
  const qcClass = qcStatus === "ok" ? "ok" : qcStatus === "warning" ? "warn" : "error";

  const card = document.createElement("article");
  card.className = "well-card";
  const geoSummary = well.geophysics || {};
  const somSummary = well.ml?.som || {};
  const somTraining = somSummary.training || {};
  const somGrid = somSummary.grid || {};
  card.innerHTML = `
    <div class="well-header">
      <div>
        <h3 class="well-title">${well.well_name}</h3>
        <p class="well-subtitle">API ${well.api || "N/A"} | ${well.file_name} | LAS ${well.las_version || "N/A"}</p>
      </div>
      <div class="tag-wrap">
        ${makeTag(`QC ${fmt(well.qc?.data_score, 1)}`, qcClass)}
        ${makeTag(`Rows ${well.n_rows ?? "N/A"}`)}
        ${makeTag(`${well.company || "Unknown company"}`)}
      </div>
    </div>

    <div class="split">
      <div>
        <strong>QC Checks</strong>
        <ul id="qc-list-${idx}" class="qc-list"></ul>
      </div>
      <div>
        <strong>Petrophysics</strong>
        <ul class="qc-list">
          <li>Avg Vsh: ${fmt(well.petrophysics?.summary?.avg_vsh, 4)}</li>
          <li>Avg Phi: ${fmt(well.petrophysics?.summary?.avg_phi, 4)}</li>
          <li>Avg Sw: ${fmt(well.petrophysics?.summary?.avg_sw, 4)}</li>
          <li>Net Reservoir Points: ${well.petrophysics?.summary?.net_reservoir_points ?? 0}</li>
        </ul>
      </div>
      <div>
        <strong>ML</strong>
        <ul class="qc-list">
          <li>Status: ${well.ml?.status ?? "N/A"}</li>
          <li>Anomaly %: ${fmt(well.ml?.anomalies?.pct, 2)}</li>
          <li>Facies Clusters: ${well.ml?.electrofacies?.n_clusters ?? "N/A"}</li>
          <li>SOM Grid: ${somGrid.rows && somGrid.cols ? `${somGrid.rows}x${somGrid.cols}` : "N/A"}</li>
          <li>SOM QE / TE: ${fmt(somTraining.quantization_error, 4)} / ${fmt(somTraining.topological_error, 4)}</li>
        </ul>
      </div>
      <div>
        <strong>Geophysics</strong>
        <ul class="qc-list">
          <li>Avg velocity: ${fmt(geoSummary.avg_velocity_ft_s, 1)} ft/s</li>
          <li>Avg density: ${fmt(geoSummary.avg_density_g_cc, 4)} g/cc</li>
          <li>Density model: ${geoSummary.density_method || "N/A"}</li>
          <li>Reflectivity energy: ${fmt(geoSummary.reflectivity_energy, 5)}</li>
          <li>${geoSummary.assumption || "No geophysics assumption available"}</li>
        </ul>
      </div>
    </div>

    <div id="raw-grid-${idx}" class="raw-grid"></div>
    <div id="derived-plot-${idx}" class="plot well-plot"></div>
    <div id="geo-plot-${idx}" class="plot well-plot"></div>
    <div id="som-map-${idx}" class="plot"></div>
    <div id="som-track-${idx}" class="plot well-plot"></div>
  `;

  wellCards.appendChild(card);

  const qcList = document.getElementById(`qc-list-${idx}`);
  for (const check of well.qc?.checks || []) {
    const li = document.createElement("li");
    li.textContent = `[${check.severity}] ${check.message}`;
    qcList.appendChild(li);
  }

  const depth = well.tracks?.depth || [];
  const raw = well.tracks?.raw || {};
  const anomalyFlags = well.tracks?.anomaly_flags || [];

  const rawPalette = {
    GR: "#58d1b2",
    DT: "#4ab0ff",
    RESD: "#f2bf58",
    SP: "#f08a84",
    RHOB: "#bca2ff",
    NPHI: "#9ed36a",
  };

  const rawCurveKeys = ["GR", "DT", "RESD", "SP", "RHOB", "NPHI"].filter((key) => hasNumericData(raw[key]));
  const rawGrid = document.getElementById(`raw-grid-${idx}`);
  rawGrid.innerHTML = "";

  if (rawCurveKeys.length) {
    for (const key of rawCurveKeys) {
      const card = document.createElement("section");
      card.className = "raw-track-card";

      const plotId = `raw-track-${idx}-${key}`;
      const mappedCurve = (well.curve_map?.[key] || key).toUpperCase();
      const unit = well.curve_units?.[mappedCurve] || "";
      const titleText = unit ? `${key} (${unit})` : key;
      card.innerHTML = `<p class="raw-track-label">${titleText}</p><div id="${plotId}" class="plot raw-track-plot"></div>`;
      rawGrid.appendChild(card);

      const curve = raw[key];
      const range = axisRangeFromSeries(curve);
      const trackColor = rawPalette[key] || "#8bc1da";

      const traces = [
        {
          x: curve,
          y: depth,
          type: "scatter",
          mode: "lines",
          line: { width: 1.6, color: trackColor },
          hovertemplate: `Depth %{y}<br>${titleText}: %{x:.3f}<extra></extra>`,
          showlegend: false,
          name: key,
        },
      ];

      if (anomalyFlags.length && depth.length) {
        const anomalyX = [];
        const anomalyDepths = [];
        for (let i = 0; i < anomalyFlags.length; i += 1) {
          if (anomalyFlags[i] === 1) {
            const value = curve[i];
            if (typeof value === "number" && Number.isFinite(value)) {
              anomalyX.push(value);
              anomalyDepths.push(depth[i]);
            }
          }
        }

        if (anomalyDepths.length) {
          traces.push({
            x: anomalyX,
            y: anomalyDepths,
            type: "scatter",
            mode: "markers",
            marker: { size: 5, color: "#ff6e74", symbol: "diamond" },
            hovertemplate: `Depth %{y}<br>${titleText}: %{x:.3f}<br>ML anomaly<extra></extra>`,
            showlegend: false,
            name: "Anomaly",
          });
        }
      }

      Plotly.newPlot(
        plotId,
        traces,
        {
          ...PLOT_LAYOUT_BASE,
          margin: { l: 62, r: 16, t: 30, b: 42 },
          xaxis: {
            title: titleText,
            gridcolor: "rgba(166,197,217,0.1)",
            ...(range ? { range } : {}),
          },
          yaxis: { title: "Depth", autorange: "reversed", gridcolor: "rgba(166,197,217,0.1)" },
          showlegend: false,
        },
        { responsive: true, displaylogo: false }
      );
    }
  } else {
    rawGrid.innerHTML = `<div class="plot-empty">No raw log curves available.</div>`;
  }

  const derived = well.tracks?.derived || {};
  const derivedTraces = [];

  if (derived.vsh) {
    derivedTraces.push({
      x: derived.vsh,
      y: depth,
      type: "scatter",
      mode: "lines",
      name: "Vsh",
      line: { color: "#f0c061", width: 2 },
      fill: "tozerox",
      fillcolor: "rgba(240,192,97,0.16)",
    });
  }
  if (derived.phi) {
    derivedTraces.push({
      x: derived.phi,
      y: depth,
      type: "scatter",
      mode: "lines",
      name: "Phi",
      line: { color: "#54d1a0", width: 2 },
      fill: "tozerox",
      fillcolor: "rgba(84,209,160,0.14)",
    });
  }
  if (derived.sw) {
    derivedTraces.push({
      x: derived.sw,
      y: depth,
      type: "scatter",
      mode: "lines",
      name: "Sw",
      line: { color: "#2fa7c8", width: 2 },
      fill: "tozerox",
      fillcolor: "rgba(47,167,200,0.14)",
    });
  }

  Plotly.newPlot(
    `derived-plot-${idx}`,
    derivedTraces,
    {
      ...PLOT_LAYOUT_BASE,
      title: { text: "Derived Petrophysical Response", font: { size: 14 } },
      margin: { l: 60, r: 28, t: 38, b: 35 },
      xaxis: { title: "Value", range: [0, 1], gridcolor: "rgba(166,197,217,0.1)" },
      yaxis: { title: "Depth", autorange: "reversed", gridcolor: "rgba(166,197,217,0.1)" },
      legend: { orientation: "h" },
    },
    { responsive: true, displaylogo: false }
  );

  const geoTracks = well.tracks?.geophysics || {};
  const geoDepth = geoTracks.depth || depth;
  const velocity = geoTracks.velocity_ft_s || [];
  const density = geoTracks.density_g_cc || [];
  const aiProxy = geoTracks.ai_proxy || [];
  const reflectivity = geoTracks.reflectivity || [];

  if (hasNumericData(velocity) || hasNumericData(density) || hasNumericData(aiProxy) || hasNumericData(reflectivity)) {
    const geoTraces = [];
    if (hasNumericData(velocity)) {
      geoTraces.push({
        x: normalizeSeries(velocity),
        y: geoDepth,
        type: "scatter",
        mode: "lines",
        name: "Velocity (norm)",
        line: { color: "#7dc3ff", width: 1.9 },
      });
    }
    if (hasNumericData(density)) {
      geoTraces.push({
        x: normalizeSeries(density),
        y: geoDepth,
        type: "scatter",
        mode: "lines",
        name: "Density (norm)",
        line: { color: "#c39eff", width: 1.8 },
      });
    }
    if (hasNumericData(aiProxy)) {
      geoTraces.push({
        x: normalizeSeries(aiProxy),
        y: geoDepth,
        type: "scatter",
        mode: "lines",
        name: "AI proxy (norm)",
        line: { color: "#f2bf58", width: 1.8 },
      });
    }
    if (hasNumericData(reflectivity)) {
      geoTraces.push({
        x: reflectivity,
        y: geoDepth,
        type: "scatter",
        mode: "lines",
        name: "Reflectivity",
        xaxis: "x2",
        line: { color: "#ff7f90", width: 1.5 },
      });
    }

    Plotly.newPlot(
      `geo-plot-${idx}`,
      geoTraces,
      {
        ...PLOT_LAYOUT_BASE,
        title: { text: "Geophysics Quicklook: Velocity / Density / AI / Reflectivity", font: { size: 14 } },
        margin: { l: 60, r: 50, t: 38, b: 35 },
        xaxis: {
          title: "Normalized Velocity / Density / AI",
          range: [0, 1],
          gridcolor: "rgba(166,197,217,0.1)",
        },
        xaxis2: {
          title: "Reflectivity",
          overlaying: "x",
          side: "top",
          range: [-0.25, 0.25],
          showgrid: false,
          tickfont: { color: "#ffb8c0" },
        },
        yaxis: { title: "Depth", autorange: "reversed", gridcolor: "rgba(166,197,217,0.1)" },
        legend: { orientation: "h" },
      },
      { responsive: true, displaylogo: false }
    );
  } else {
    renderEmptyPlot(document.getElementById(`geo-plot-${idx}`), "Geophysics quicklook requires DT data.");
  }

  const som = well.ml?.som || {};
  const somBmu = well.tracks?.som_bmu || [];
  if (som.status === "ok" && Array.isArray(som.u_matrix) && som.u_matrix.length) {
    const uMatrix = som.u_matrix;
    const hitsMatrix = som.node_hits || [];
    const rows = som.grid?.rows || uMatrix.length;
    const cols = som.grid?.cols || (uMatrix[0] ? uMatrix[0].length : 0);

    const overlayX = [];
    const overlayY = [];
    const overlaySize = [];
    const overlayText = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const h = (hitsMatrix[r] && hitsMatrix[r][c]) || 0;
        overlayX.push(c);
        overlayY.push(r);
        overlaySize.push(Math.max(8, 8 + h * 0.7));
        overlayText.push(`Node (${r},${c}) hits: ${h}`);
      }
    }

    Plotly.newPlot(
      `som-map-${idx}`,
      [
        {
          type: "heatmap",
          z: uMatrix,
          colorscale: "Cividis",
          colorbar: { title: "U-Matrix" },
          hovertemplate: "Row %{y}, Col %{x}<br>U: %{z:.4f}<extra></extra>",
        },
        {
          type: "scatter",
          mode: "markers",
          x: overlayX,
          y: overlayY,
          marker: {
            size: overlaySize,
            color: "rgba(255,255,255,0.25)",
            line: { color: "#d9ecfa", width: 0.6 },
          },
          text: overlayText,
          hovertemplate: "%{text}<extra></extra>",
          showlegend: false,
        },
      ],
      {
        ...PLOT_LAYOUT_BASE,
        title: { text: "SOM U-Matrix + Node Hits", font: { size: 14 } },
        margin: { l: 55, r: 24, t: 38, b: 45 },
        xaxis: { title: "SOM Col", dtick: 1 },
        yaxis: { title: "SOM Row", dtick: 1, autorange: "reversed" },
      },
      { responsive: true, displaylogo: false }
    );
  } else {
    renderEmptyPlot(document.getElementById(`som-map-${idx}`), "SOM map unavailable.");
  }

  if (hasNumericData(somBmu) && depth.length) {
    Plotly.newPlot(
      `som-track-${idx}`,
      [
        {
          type: "scatter",
          mode: "markers",
          x: somBmu,
          y: depth,
          marker: {
            size: 6,
            color: somBmu,
            colorscale: "Turbo",
            showscale: true,
            colorbar: { title: "BMU" },
          },
          hovertemplate: "Depth %{y}<br>SOM BMU %{x}<extra></extra>",
          name: "SOM BMU",
        },
      ],
      {
        ...PLOT_LAYOUT_BASE,
        title: { text: "SOM Facies Track (Depth vs BMU)", font: { size: 14 } },
        margin: { l: 60, r: 54, t: 38, b: 35 },
        xaxis: { title: "BMU Node Index", gridcolor: "rgba(166,197,217,0.1)" },
        yaxis: { title: "Depth", autorange: "reversed", gridcolor: "rgba(166,197,217,0.1)" },
      },
      { responsive: true, displaylogo: false }
    );
  } else {
    renderEmptyPlot(document.getElementById(`som-track-${idx}`), "SOM facies track unavailable.");
  }
}

const SEQ_TRACT_COLORS = {
  "Progradation - Regression": "rgba(211,74,74,0.20)",
  "Retrogradation - Transgression": "rgba(71,121,216,0.20)",
  "Steady Aggradation": "rgba(108,186,101,0.20)",
  UNDEF: "rgba(136,136,136,0.15)",
};

function getSequenceReportForWell(wellName) {
  if (!currentPayload || !Array.isArray(currentPayload.wells)) return null;
  return currentPayload.wells.find((w) => w.well_name === wellName) || null;
}

function ensureSequenceSelection() {
  const wells = (currentPayload?.wells || []).filter((w) => (w.sequence_stratigraphy || {}).status === "ok");
  if (!wells.length) {
    sequenceState.selectedWell = null;
    return;
  }
  if (!sequenceState.selectedWell || !wells.some((w) => w.well_name === sequenceState.selectedWell)) {
    sequenceState.selectedWell = wells[0].well_name;
  }
}

function ensureSequenceEditState(wellName) {
  if (!sequenceState.editsByWell[wellName]) {
    sequenceState.editsByWell[wellName] = {
      statusByBoundaryId: {},
      manualBoundaries: [],
    };
  }
  return sequenceState.editsByWell[wellName];
}

function getMergedBoundaries(seq, editState) {
  const threshold = sequenceState.threshold;
  const autos = (seq.boundaries_auto || [])
    .filter((row) => (row.confidence ?? 0) >= threshold)
    .map((row) => ({ ...row, source: "auto" }));
  const manuals = (editState.manualBoundaries || []).map((row) => ({ ...row, source: "manual" }));
  const merged = [...autos, ...manuals].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));
  return merged.map((row) => ({
    ...row,
    status: editState.statusByBoundaryId[row.id] || row.status || "pending",
  }));
}

function renderSequenceBoundaryList(seq, boundaries, editState) {
  sequenceBoundaryList.innerHTML = "";
  if (!boundaries.length) {
    sequenceBoundaryList.innerHTML = `<li class="sequence-boundary-item">No boundaries above current confidence threshold.</li>`;
    return;
  }

  for (const row of boundaries) {
    const item = document.createElement("li");
    item.className = "sequence-boundary-item";
    const confidence = row.confidence ?? 0;
    const status = row.status || "pending";
    const isAccept = status === "accepted";
    const isReject = status === "rejected";
    item.innerHTML = `
      <div class="sequence-boundary-head">
        <strong>${row.id} | Depth ${fmt(row.depth, 2)}</strong>
        <div class="sequence-boundary-actions">
          <button data-action="accept" data-boundary-id="${row.id}" class="${isAccept ? "active-accept" : ""}">Accept</button>
          <button data-action="reject" data-boundary-id="${row.id}" class="${isReject ? "active-reject" : ""}">Reject</button>
          <button data-action="pending" data-boundary-id="${row.id}">Pending</button>
          ${
            row.source === "manual"
              ? `<button data-action="delete-manual" data-boundary-id="${row.id}">Delete</button>`
              : ""
          }
        </div>
      </div>
      <div class="meta">Confidence: ${fmt(confidence, 3)} | ${row.from_tract || "?"} -> ${row.to_tract || "?"} | Status: ${status}</div>
    `;
    sequenceBoundaryList.appendChild(item);
  }
}

function renderSequencePlotForWell(report) {
  const seq = report.sequence_stratigraphy || {};
  if (seq.status !== "ok") {
    renderEmptyPlot(sequencePlot, "Sequence stratigraphy unavailable for selected well.");
    sequenceMeta.textContent = seq.reason || "No sequence data.";
    sequenceBoundaryList.innerHTML = "";
    return;
  }

  const tracks = seq.tracks || {};
  const depth = tracks.depth || [];
  const signal = tracks.signal || [];
  const smooth = tracks.signal_smooth || [];
  const intervals = seq.intervals_auto || [];

  const editState = ensureSequenceEditState(report.well_name);
  const boundaries = getMergedBoundaries(seq, editState);
  renderSequenceBoundaryList(seq, boundaries, editState);

  const shapes = [];
  for (const interval of intervals) {
    const fill = SEQ_TRACT_COLORS[interval.tract] || SEQ_TRACT_COLORS.UNDEF;
    shapes.push({
      type: "rect",
      xref: "paper",
      yref: "y",
      x0: 0,
      x1: 1,
      y0: interval.top,
      y1: interval.base,
      fillcolor: fill,
      line: { width: 0 },
      layer: "below",
    });
  }

  for (const boundary of boundaries) {
    const status = boundary.status || "pending";
    let color = "rgba(217,236,250,0.35)";
    let dash = "dot";
    if (status === "accepted") {
      color = "rgba(84,209,160,0.92)";
      dash = "solid";
    } else if (status === "rejected") {
      color = "rgba(255,110,116,0.92)";
      dash = "dash";
    }
    shapes.push({
      type: "line",
      xref: "paper",
      yref: "y",
      x0: 0,
      x1: 1,
      y0: boundary.depth,
      y1: boundary.depth,
      line: { color, width: 1.5, dash },
      layer: "above",
    });
  }

  Plotly.newPlot(
    sequencePlot,
    [
      {
        type: "scatter",
        mode: "lines",
        x: signal,
        y: depth,
        line: { color: "#f2bf58", width: 1.2 },
        name: `${seq.source_curve || "Curve"} raw`,
        hovertemplate: "Depth %{y}<br>Signal %{x:.4f}<extra></extra>",
      },
      {
        type: "scatter",
        mode: "lines",
        x: smooth,
        y: depth,
        line: { color: "#7dc3ff", width: 2.0 },
        name: "Smoothed",
        hovertemplate: "Depth %{y}<br>Smoothed %{x:.4f}<extra></extra>",
      },
    ],
    {
      ...PLOT_LAYOUT_BASE,
      title: { text: `Sequence Log: ${report.well_name}`, font: { size: 14 } },
      margin: { l: 65, r: 30, t: 38, b: 42 },
      xaxis: { title: `${seq.source_curve || "Signal"} (transformed)`, gridcolor: "rgba(166,197,217,0.12)" },
      yaxis: { title: "Depth", autorange: "reversed", gridcolor: "rgba(166,197,217,0.12)" },
      legend: { orientation: "h" },
      shapes,
    },
    { responsive: true, displaylogo: false }
  );

  sequenceMeta.textContent =
    `${seq.method?.type || "sequence"} | window ${seq.method?.window || "N/A"} | ` +
    `auto boundaries ${seq.summary?.n_boundaries_auto ?? 0} | dominant tract: ${seq.summary?.dominant_tract || "N/A"}`;
}

function renderSequenceCorrelation(analytics) {
  const correlation = analytics?.sequence_correlation || {};
  if (correlation.status !== "ok" || !(correlation.surface_names || []).length) {
    renderEmptyPlot(sequenceCorrelationPlot, "Sequence correlation unavailable.");
    sequenceCorrelationMeta.textContent = correlation.status === "ok" ? "" : (correlation.notes || "Need multiple wells with valid sequence picks.");
    return;
  }

  const z = (correlation.relative_matrix || []).map((row) => row.map((v) => (typeof v === "number" ? v : null)));
  const depthText = correlation.depth_matrix || [];

  Plotly.newPlot(
    sequenceCorrelationPlot,
    [
      {
        type: "heatmap",
        z,
        x: correlation.well_names,
        y: correlation.surface_names,
        zmin: 0,
        zmax: 1,
        colorscale: "YlGnBu",
        customdata: depthText,
        hovertemplate:
          "Surface %{y}<br>Well %{x}<br>Relative position %{z:.3f}<br>Depth %{customdata:.2f}<extra></extra>",
      },
    ],
    {
      ...PLOT_LAYOUT_BASE,
      margin: { l: 80, r: 24, t: 26, b: 58 },
      xaxis: { tickangle: -22 },
      yaxis: { autorange: "reversed" },
    },
    { responsive: true, displaylogo: false }
  );
  sequenceCorrelationMeta.textContent = `${correlation.method || "correlation"} | ${correlation.notes || ""}`;
}

function renderSequenceWellOptions() {
  const wells = (currentPayload?.wells || []).filter((w) => (w.sequence_stratigraphy || {}).status === "ok");
  sequenceWellSelect.innerHTML = "";
  for (const well of wells) {
    const option = document.createElement("option");
    option.value = well.well_name;
    option.textContent = well.well_name;
    sequenceWellSelect.appendChild(option);
  }
  if (sequenceState.selectedWell) {
    sequenceWellSelect.value = sequenceState.selectedWell;
  }
}

function renderSequenceTab() {
  if (!currentPayload || !(currentPayload.wells || []).length) {
    renderEmptyPlot(sequencePlot, "Run analysis first.");
    renderEmptyPlot(sequenceCorrelationPlot, "Run analysis first.");
    sequenceBoundaryList.innerHTML = "";
    sequenceMeta.textContent = "No active analysis.";
    sequenceCorrelationMeta.textContent = "";
    setMarkdownContent(sequenceAiText, "Run analysis and click AI Autocomplete Suggestions.");
    return;
  }

  ensureSequenceSelection();
  renderSequenceWellOptions();

  if (!sequenceState.selectedWell) {
    renderEmptyPlot(sequencePlot, "No wells with valid sequence data.");
    renderEmptyPlot(sequenceCorrelationPlot, "No correlation available.");
    sequenceBoundaryList.innerHTML = "";
    sequenceMeta.textContent = "No sequence-capable wells in this run.";
    return;
  }

  const report = getSequenceReportForWell(sequenceState.selectedWell);
  if (!report) {
    renderEmptyPlot(sequencePlot, "Selected well not found.");
    return;
  }

  renderSequencePlotForWell(report);
  renderSequenceCorrelation(currentPayload.portfolio_analytics || {});
  setSequenceStatus(`Reviewing ${sequenceState.selectedWell}. Accept/reject picks and add manual boundaries.`);
}

async function requestSequenceAiSuggestion() {
  if (!currentAnalysisId || !currentPayload) {
    setSequenceStatus("Run analysis first.");
    return;
  }
  const report = getSequenceReportForWell(sequenceState.selectedWell);
  if (!report) {
    setSequenceStatus("Select a well first.");
    return;
  }

  setSequenceAiLoading(true);
  try {
    const seq = report.sequence_stratigraphy || {};
    const prompt = [
      `Provide sequence-stratigraphy autocomplete suggestions for well ${report.well_name}.`,
      "Focus on which auto-picked boundaries should be accepted/rejected and where manual boundaries may be required.",
      "Return concise sections: Accepted, Rejected, Add-manual, and Rationale.",
      `Curve used: ${seq.source_curve || "N/A"}.`,
      `Auto boundaries: ${JSON.stringify((seq.boundaries_auto || []).slice(0, 15))}`,
      `Intervals: ${JSON.stringify((seq.intervals_auto || []).slice(0, 20))}`,
      `Confidence threshold in UI: ${sequenceState.threshold.toFixed(2)}`,
    ].join("\n");

    const response = await runAnalyzeRequest("/api/chat-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysis_id: currentAnalysisId,
        question: prompt,
        history: [],
        with_ai: aiToggle.checked,
      }),
    });

    setSequenceAiLoading(false);
    sequenceAiMeta.textContent = formatMeta(response.meta);
    setMarkdownContent(sequenceAiText, response.answer || "No AI suggestion returned.");
    setSequenceStatus("AI sequence suggestions generated. Review and approve manually.");
  } catch (err) {
    setSequenceAiLoading(false);
    sequenceAiMeta.textContent = `Source: error | ${err.message}`;
    setMarkdownContent(sequenceAiText, "AI sequence suggestion failed.");
    setSequenceStatus(`Error: ${err.message}`);
  }
}

function applyBoundaryStatusAction(boundaryId, action) {
  const wellName = sequenceState.selectedWell;
  if (!wellName) return;
  const editState = ensureSequenceEditState(wellName);
  if (action === "delete-manual") {
    editState.manualBoundaries = editState.manualBoundaries.filter((row) => row.id !== boundaryId);
    delete editState.statusByBoundaryId[boundaryId];
  } else if (action === "pending") {
    delete editState.statusByBoundaryId[boundaryId];
  } else if (action === "accept") {
    editState.statusByBoundaryId[boundaryId] = "accepted";
  } else if (action === "reject") {
    editState.statusByBoundaryId[boundaryId] = "rejected";
  }
  renderSequenceTab();
}

function addManualSequenceBoundary() {
  const wellName = sequenceState.selectedWell;
  if (!wellName) {
    setSequenceStatus("Select a well first.");
    return;
  }
  const depth = Number(sequenceManualDepthInput.value);
  if (!Number.isFinite(depth)) {
    setSequenceStatus("Enter a valid manual depth.");
    return;
  }
  const editState = ensureSequenceEditState(wellName);
  const id = `manual-${Date.now()}-${Math.round(Math.random() * 1e5)}`;
  editState.manualBoundaries.push({
    id,
    depth: Number(depth.toFixed(2)),
    confidence: 1.0,
    from_tract: "Manual",
    to_tract: "Manual",
    status: "accepted",
  });
  editState.statusByBoundaryId[id] = "accepted";
  sequenceManualDepthInput.value = "";
  renderSequenceTab();
  setSequenceStatus(`Manual boundary added at ${depth.toFixed(2)}.`);
}

function renderResults(payload, options = {}) {
  const { aiEnabled = false } = options;
  currentPayload = payload;
  currentAnalysisId = payload.analysis_id || null;
  currentRunToken += 1;
  sequenceState = {
    selectedWell: null,
    threshold: sequenceState.threshold,
    editsByWell: {},
  };
  sequenceConfidenceRange.value = String(Math.round(sequenceState.threshold * 100));
  sequenceConfidenceValue.textContent = sequenceState.threshold.toFixed(2);

  renderPortfolio(payload.portfolio_summary || {}, payload.density_transform || null);
  renderComparison(payload.portfolio_analytics || {});

  aiSection.classList.remove("hidden");
  if (aiEnabled && currentAnalysisId) {
    setAiLoading(true);
  } else {
    setAiLoading(false);
    setMarkdownContent(
      aiText,
      aiEnabled ? payload.ai_interpretation || "No AI interpretation." : "AI interpretation disabled by toggle."
    );
    aiMeta.textContent = formatMeta(payload.ai_meta || { source: "heuristic", reason: "AI disabled" });
  }

  chatSection.classList.remove("hidden");
  resetChatState();

  renderErrors(payload.errors || []);

  wellCards.innerHTML = "";
  for (const [idx, well] of (payload.wells || []).entries()) {
    renderWell(well, idx);
  }
  wellsSection.classList.remove("hidden");

  const hasWells = (payload.wells || []).length > 0;
  exportCsvBtn.disabled = !hasWells;
  exportPdfBtn.disabled = !hasWells;
  chatSection.classList.toggle("hidden", !hasWells || !currentAnalysisId);
  renderSequenceTab();

  setTimeout(() => {
    window.dispatchEvent(new Event("resize"));
  }, 120);
}

async function runAnalyzeRequest(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

async function requestAiInterpretation(analysisId, runToken) {
  const response = await runAnalyzeRequest("/api/ai-interpretation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      analysis_id: analysisId,
      with_ai: aiToggle.checked,
    }),
  });

  if (runToken !== currentRunToken || analysisId !== currentAnalysisId) {
    return;
  }

  if (currentPayload) {
    currentPayload.ai_interpretation = response.ai_interpretation || "";
    currentPayload.ai_meta = response.ai_meta || {};
  }
  setAiLoading(false);
  setMarkdownContent(aiText, response.ai_interpretation || "No AI interpretation.");
  aiMeta.textContent = formatMeta(response.ai_meta);
  setStatus("AI interpretation ready.");
}

async function sendChatQuestion() {
  if (isChatPending) return;
  if (!currentAnalysisId) {
    setStatus("Run analysis first to enable chat.");
    return;
  }

  const question = chatInput.value.trim();
  if (!question) {
    return;
  }

  const analysisId = currentAnalysisId;
  const priorHistory = [...chatHistory];

  chatHistory.push({ role: "user", content: question });
  renderChatMessages();
  chatInput.value = "";
  setChatPending(true);

  try {
    const response = await runAnalyzeRequest("/api/chat-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysis_id: analysisId,
        question,
        history: priorHistory,
        with_ai: aiToggle.checked,
      }),
    });

    if (analysisId !== currentAnalysisId) {
      return;
    }

    chatHistory.push({
      role: "assistant",
      content: response.answer || "No answer returned.",
    });
    renderChatMessages();
    chatMeta.textContent = `Context: ${analysisId.slice(0, 8)}... | Last response: ${formatMeta(response.meta)}`;
    setStatus("Chat response generated.");
  } catch (err) {
    if (analysisId !== currentAnalysisId) {
      return;
    }
    chatHistory.push({
      role: "assistant",
      content: `Error generating chat response: ${err.message}`,
    });
    renderChatMessages();
    setStatus(`Error: ${err.message}`);
  } finally {
    if (analysisId === currentAnalysisId) {
      setChatPending(false);
      chatInput.focus();
    }
  }
}

async function analyzeSamples() {
  const withAi = false;
  setStatus("Running sample multi-well analysis...");
  const payload = await runAnalyzeRequest(`/api/analyze-samples?with_ai=${withAi ? "true" : "false"}`, {
    method: "POST",
  });
  renderResults(payload, { aiEnabled: aiToggle.checked });
  if (aiToggle.checked && payload.analysis_id) {
    setStatus("Core analysis completed. Generating AI interpretation...");
    requestAiInterpretation(payload.analysis_id, currentRunToken).catch((err) => {
      if (payload.analysis_id !== currentAnalysisId) return;
      setAiLoading(false);
      setMarkdownContent(aiText, "AI interpretation failed.");
      aiMeta.textContent = `Source: error | ${err.message}`;
      setStatus(`Error: ${err.message}`);
    });
  } else {
    setStatus(`Completed sample analysis for ${payload.portfolio_summary?.well_count ?? 0} wells.`);
  }
}

async function analyzeUploads() {
  const files = fileInput.files;
  if (!files || !files.length) {
    setStatus("Select one or more LAS files first.");
    return;
  }

  const withAi = false;
  setStatus(`Uploading ${files.length} file(s) and running analysis...`);

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const payload = await runAnalyzeRequest(`/api/analyze-files?with_ai=${withAi ? "true" : "false"}`, {
    method: "POST",
    body: formData,
  });

  renderResults(payload, { aiEnabled: aiToggle.checked });
  if (aiToggle.checked && payload.analysis_id) {
    setStatus("Core analysis completed. Generating AI interpretation...");
    requestAiInterpretation(payload.analysis_id, currentRunToken).catch((err) => {
      if (payload.analysis_id !== currentAnalysisId) return;
      setAiLoading(false);
      setMarkdownContent(aiText, "AI interpretation failed.");
      aiMeta.textContent = `Source: error | ${err.message}`;
      setStatus(`Error: ${err.message}`);
    });
  } else {
    setStatus(`Completed uploaded analysis for ${payload.portfolio_summary?.well_count ?? 0} wells.`);
  }
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function exportCsvReport() {
  if (!currentPayload) {
    setStatus("No analysis results available for export.");
    return;
  }

  const rows = [];
  rows.push(["LAS Intel POC Report"]);
  rows.push([`Generated At`, new Date().toISOString()]);
  rows.push([]);

  rows.push(["Portfolio Summary"]);
  rows.push(["Wells", currentPayload.portfolio_summary?.well_count ?? ""]);
  rows.push(["Average QC", currentPayload.portfolio_summary?.avg_qc_score ?? ""]);
  rows.push(["Depth Samples", currentPayload.portfolio_summary?.total_depth_points ?? ""]);
  rows.push(["Wells With Potential Pay", currentPayload.portfolio_summary?.wells_with_pay ?? ""]);
  rows.push([]);

  rows.push(["Well Ranking"]);
  rows.push(["Rank", "Well", "API", "Composite", "Pay Index", "Risk Index", "QC", "Anomaly %", "Velocity (ft/s)", "Reflectivity Energy", "Quadrant"]);
  for (const row of currentPayload.portfolio_analytics?.well_ranking || []) {
    rows.push([
      row.rank,
      row.well_name,
      row.api,
      row.composite_score,
      row.pay_index,
      row.risk_index,
      row.qc_score,
      row.anomaly_pct,
      row.avg_velocity_ft_s,
      row.reflectivity_energy,
      row.quadrant,
    ]);
  }
  rows.push([]);

  rows.push(["Per Well Summary"]);
  rows.push([
    "Well",
    "API",
    "Company",
    "Rows",
    "QC",
    "Avg Vsh",
    "Avg Phi",
    "Avg Sw",
    "Net Reservoir Points",
    "Avg Velocity (ft/s)",
    "Reflectivity Energy",
    "SOM Grid",
    "SOM Quantization Error",
    "SOM Topological Error",
  ]);
  for (const well of currentPayload.wells || []) {
    const som = well.ml?.som || {};
    const somGrid = som.grid?.rows && som.grid?.cols ? `${som.grid.rows}x${som.grid.cols}` : "";
    rows.push([
      well.well_name,
      well.api,
      well.company,
      well.n_rows,
      well.qc?.data_score,
      well.petrophysics?.summary?.avg_vsh,
      well.petrophysics?.summary?.avg_phi,
      well.petrophysics?.summary?.avg_sw,
      well.petrophysics?.summary?.net_reservoir_points,
      well.geophysics?.avg_velocity_ft_s,
      well.geophysics?.reflectivity_energy,
      somGrid,
      som.training?.quantization_error,
      som.training?.topological_error,
    ]);
  }

  const csv = rows.map((line) => line.map(csvEscape).join(",")).join("\n");
  const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
  downloadBlob(`las_intel_report_${stamp}.csv`, csv, "text/csv;charset=utf-8");
  setStatus("CSV export generated.");
}

function exportPdfReport() {
  if (!currentPayload) {
    setStatus("No analysis results available for export.");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    setStatus("PDF library not loaded in browser.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const summary = currentPayload.portfolio_summary || {};
  const ranking = currentPayload.portfolio_analytics?.well_ranking || [];
  const payRisk = currentPayload.portfolio_analytics?.pay_risk_matrix || [];
  const wells = currentPayload.wells || [];

  doc.setFillColor(14, 30, 44);
  doc.rect(0, 0, 595, 72, "F");
  doc.setTextColor(234, 244, 251);
  doc.setFontSize(20);
  doc.text("LAS Intel POC - Demo Report", 40, 45);

  doc.setTextColor(39, 58, 73);
  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 98);
  doc.text(`Wells analyzed: ${summary.well_count ?? 0}`, 40, 116);
  doc.text(`Average QC: ${fmt(summary.avg_qc_score, 1)}`, 190, 116);
  doc.text(`Avg anomaly %: ${fmt(summary.avg_anomaly_pct, 2)}`, 330, 116);

  doc.autoTable({
    startY: 132,
    head: [["Rank", "Well", "API", "Composite", "Pay", "Risk", "Velocity", "Reflectivity", "Quadrant"]],
    body: ranking.map((r) => [
      r.rank,
      r.well_name,
      r.api || "N/A",
      fmt(r.composite_score, 2),
      fmt(r.pay_index, 2),
      fmt(r.risk_index, 2),
      fmt(r.avg_velocity_ft_s, 1),
      fmt(r.reflectivity_energy, 5),
      r.quadrant,
    ]),
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [47, 167, 200] },
  });

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 16,
    head: [["Well", "QC", "Anomaly %", "Net Reservoir Fraction", "Pay", "Risk"]],
    body: payRisk.map((r) => [
      r.well_name,
      fmt(r.qc_score, 1),
      fmt(r.anomaly_pct, 2),
      fmt(r.net_reservoir_fraction, 4),
      fmt(r.pay_index, 2),
      fmt(r.risk_index, 2),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [84, 209, 160] },
  });

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 16,
    head: [["Well", "SOM Grid", "SOM QE", "SOM TE"]],
    body: wells.map((w) => {
      const som = w.ml?.som || {};
      const somGrid = som.grid?.rows && som.grid?.cols ? `${som.grid.rows}x${som.grid.cols}` : "N/A";
      return [
        w.well_name,
        somGrid,
        fmt(som.training?.quantization_error, 4),
        fmt(som.training?.topological_error, 4),
      ];
    }),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [242, 191, 88] },
  });

  doc.setFontSize(10);
  doc.setTextColor(70, 84, 98);
  const interpretation = (currentPayload.ai_interpretation || "").slice(0, 1700);
  const wrapped = doc.splitTextToSize(`AI Interpretation:\n${interpretation}`, 510);

  let y = doc.lastAutoTable.finalY + 20;
  if (y > 740) {
    doc.addPage();
    y = 60;
  }
  doc.text(wrapped, 40, y);

  const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
  doc.save(`las_intel_report_${stamp}.pdf`);
  setStatus("PDF export generated.");
}

async function launchDemoMode() {
  demoToggle.checked = true;
  setDemoModeVisuals(true);
  setStatus("Launching demo mode workflow...");
  await analyzeSamples();
  setStatus("Demo mode ready. Use Export PDF/CSV for committee/company showcase.");
}

analyzeSamplesBtn.addEventListener("click", async () => {
  try {
    await analyzeSamples();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});

analyzeUploadBtn.addEventListener("click", async () => {
  try {
    await analyzeUploads();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});

demoRunBtn.addEventListener("click", async () => {
  try {
    await launchDemoMode();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});

demoToggle.addEventListener("change", () => {
  setDemoModeVisuals(demoToggle.checked);
});

exportCsvBtn.addEventListener("click", () => {
  try {
    exportCsvReport();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});

exportPdfBtn.addEventListener("click", () => {
  try {
    exportPdfReport();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});

chatSendBtn.addEventListener("click", async () => {
  try {
    await sendChatQuestion();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});

chatInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    try {
      await sendChatQuestion();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }
});

chatClearBtn.addEventListener("click", () => {
  resetChatState();
  setStatus("Chat history cleared.");
});

overviewTabBtn.addEventListener("click", () => {
  setActiveTab("overview");
});

sequenceTabBtn.addEventListener("click", () => {
  setActiveTab("sequence");
});

sequenceWellSelect.addEventListener("change", () => {
  sequenceState.selectedWell = sequenceWellSelect.value || null;
  renderSequenceTab();
});

sequenceConfidenceRange.addEventListener("input", () => {
  const val = Number(sequenceConfidenceRange.value);
  sequenceState.threshold = Math.max(0.0, Math.min(1.0, val / 100.0));
  sequenceConfidenceValue.textContent = sequenceState.threshold.toFixed(2);
  renderSequenceTab();
});

sequenceAiSuggestBtn.addEventListener("click", async () => {
  try {
    await requestSequenceAiSuggestion();
  } catch (err) {
    setSequenceStatus(`Error: ${err.message}`);
  }
});

sequenceResetEditsBtn.addEventListener("click", () => {
  if (sequenceState.selectedWell) {
    delete sequenceState.editsByWell[sequenceState.selectedWell];
    renderSequenceTab();
    setSequenceStatus("Human edits reset for selected well.");
  }
});

sequenceBoundaryList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.getAttribute("data-action");
  const boundaryId = target.getAttribute("data-boundary-id");
  if (!action || !boundaryId) return;
  applyBoundaryStatusAction(boundaryId, action);
});

sequenceAddManualBtn.addEventListener("click", () => {
  addManualSequenceBoundary();
});

sequenceManualDepthInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addManualSequenceBoundary();
  }
});

setActiveTab("overview");
resetChatState();
setSequenceAiLoading(false);
setMarkdownContent(sequenceAiText, "Run analysis and click AI Autocomplete Suggestions.");

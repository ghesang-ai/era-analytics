const BRAND_URLS = {
  EAR:     "./outputs/dashboard_data_ear_pnl.json",
  IBOX:    "./outputs/dashboard_data_ibox.json",
  SAMSUNG: "./outputs/dashboard_data_samsung.json",
};
const EAR_FULL_URL = "./outputs/dashboard_data_v2.json";
const BRAND_LABELS = {
  EAR:     "Erafone (EAR)",
  IBOX:    "iBox (DCM)",
  SAMSUNG: "Samsung (NASA)",
};
const importUrl = "./cgi-bin/import_sales.py";

let dashboardState = null;
let selectedUpload = null;

// ── Store Detail Panel ─────────────────────────────────────────────────────
function openStoreDetail(code) {
  if (!dashboardState) return;
  const s = dashboardState.stores.find(x => x.code === code);
  if (!s) return;

  const fmtB = v => v ? 'Rp ' + (v / 1e9).toFixed(2) + ' M' : 'Tidak tersedia';
  const hc = s.health >= 70 ? '#16a34a' : s.health >= 50 ? '#d97706' : '#dc2626';

  document.getElementById('sdpName').textContent = s.name;
  document.getElementById('sdpPills').innerHTML = `
    <span class="cluster-tag ${s.channel === 'Erafone' ? 'channel-erafone' : 'channel-more'}">${s.channel}</span>
    <span class="cluster-tag ${clusterClass(s.cluster)}">${s.cluster}</span>`;

  const hEl = document.getElementById('sdpHealth');
  hEl.textContent = s.health;
  hEl.style.color = hc;
  const hbar = document.getElementById('sdpHbar');
  hbar.style.width = s.health + '%';
  hbar.style.background = hc;

  document.getElementById('sdpBep').textContent = s.bep ? fmtB(s.bep) : 'Tidak tersedia';
  document.getElementById('sdpBest').textContent = fmtB(s.bestMonthSales);
  const gapEl = document.getElementById('sdpGap');
  gapEl.textContent = (s.bepGap >= 0 ? '+' : '') + fmtB(s.bepGap);
  gapEl.style.color = s.bepGap >= 0 ? '#16a34a' : '#dc2626';
  document.getElementById('sdpBepStatus').innerHTML =
    `<span class="bep-tag ${bepClass(s)}">${getBepLabel(s)}</span>`;

  const ys = [s.sales.y2022, s.sales.y2023, s.sales.y2024, s.sales.y2025, s.sales.y2026];
  const maxY = Math.max(...ys) || 1;
  const cols = ['#94a3b8','#60a5fa','#3b82f6','#10b981','#6366f1'];
  document.getElementById('sdpBars').innerHTML = ['2022','2023','2024','2025','2026'].map((yr, i) => `
    <div class="sdp-bar-row">
      <span class="sdp-yr">${yr}</span>
      <div class="sdp-bar-track"><div class="sdp-bar-fill" style="width:${ys[i]?Math.round(ys[i]/maxY*100):0}%;background:${cols[i]}"></div></div>
      <span class="sdp-bar-val">${(ys[i]/1e9).toFixed(1)} M</span>
    </div>`).join('');

  document.getElementById('sdpTsh').textContent = s.tsh;
  document.getElementById('sdpChannel').innerHTML =
    `<span class="cluster-tag ${s.channel === 'Erafone' ? 'channel-erafone' : 'channel-more'}">${s.channel}</span>`;
  document.getElementById('sdpCode').textContent = s.code;
  document.getElementById('sdpStatus').textContent = s.status || '—';
  const yoyEl = document.getElementById('sdpYoy');
  yoyEl.textContent = (s.yoy > 0 ? '+' : '') + s.yoy + '%';
  yoyEl.style.color = s.yoy > 0 ? '#16a34a' : s.yoy < 0 ? '#dc2626' : '#6b7280';

  document.getElementById('storeOverlay').classList.add('open');
  document.getElementById('storeDetailPanel').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeStoreDetail() {
  document.getElementById('storeOverlay').classList.remove('open');
  document.getElementById('storeDetailPanel').classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeStoreDetail(); });

// Nav link smooth scroll — ensures iOS tap always works (href="#anchor" alone unreliable on Safari)
document.querySelectorAll('.nav-list a[href^="#"]').forEach(link => {
  link.addEventListener('click', function(e) {
    const id = this.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    // Skip hidden sections — don't swallow the click
    if (!target || target.style.display === 'none') return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('.nav-list a').forEach(a => a.classList.remove('active'));
    this.classList.add('active');
    // Flash the target section so user sees where they navigated
    target.classList.remove('nav-target-flash');
    void target.offsetWidth; // force reflow to restart animation
    target.classList.add('nav-target-flash');
    setTimeout(() => target.classList.remove('nav-target-flash'), 800);
  });
});

let listenersBound = false;
let currentBrand = "EAR";

// ── Brand section IDs that are EAR-only ─────────────────────────────────────
const EAR_ONLY_IDS = [
  "clusterSection", "overviewGrid", "earSummaryGrid",
  "data-toko", "tsh-performance", "bep-tracker", "ai-insights",
];

function _setEarSections(visible) {
  EAR_ONLY_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? "" : "none";
    // Also hide/show the corresponding sidebar nav link
    const navLink = document.querySelector(`.nav-list a[href="#${id}"]`);
    if (navLink) navLink.style.display = visible ? "" : "none";
  });
  const brandStores = document.getElementById("brandPnlStores");
  if (brandStores) brandStores.style.display = visible ? "none" : "";
  const earTabs = document.getElementById("earTabStrip");
  if (earTabs) earTabs.style.display = visible ? "" : "none";
}

function switchBrand(key) {
  if (!BRAND_URLS[key]) return;
  currentBrand = key;

  // Update pill active state
  document.querySelectorAll("#brandSwitcher .brand-pill").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.brand === key);
  });

  fetch(`${BRAND_URLS[key]}?t=${Date.now()}`)
    .then((r) => r.json())
    .then((data) => {
      dashboardState = data;
      renderBrandView(data);
      bindEvents();
    })
    .catch((err) => console.error("Brand load error:", err));
}

function loadFullDashboard() {
  fetch(`${EAR_FULL_URL}?t=${Date.now()}`)
    .then((r) => r.json())
    .then((data) => {
      dashboardState = data;
      currentBrand = "EAR";
      document.querySelectorAll("#brandSwitcher .brand-pill").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.brand === "EAR");
      });
      renderAll(data);
    })
    .catch((err) => console.error("Full dashboard load error:", err));
}

function renderBrandView(data) {
  const ex = data.executive;
  const label = BRAND_LABELS[currentBrand] || currentBrand;

  // Hero
  document.getElementById("heroDataPeriod").textContent = ex.periodLabel || "—";
  document.getElementById("heroDataNote").textContent = `${label} · ${ex.totalStores} Stores`;

  // KPI strip — repurpose existing cards
  document.getElementById("metricTotalStores").textContent = ex.totalStores;
  document.getElementById("metricTotalStoresNote").textContent = label;
  document.getElementById("metricBepReached").textContent = ex.profitStores;
  document.getElementById("metricBepReachedNote").textContent = "Profit stores";
  document.getElementById("metricBelowBep").textContent = ex.lossStores;
  document.getElementById("metricBelowBepNote").textContent = "Loss stores";
  document.getElementById("metricRevenue2025").textContent = ex.summaryNetSales;
  document.getElementById("metricRevenue2025Note").textContent = "Net Sales YTD";
  document.getElementById("metricYoy").textContent = `${(ex.gpPct * 100).toFixed(1)}%`;
  document.getElementById("metricYoyNote").textContent = "GP Margin";
  document.getElementById("metricAvgHealth").textContent = ex.summaryNetFinal;
  document.getElementById("metricDataPeriod").textContent = ex.periodLabel || "—";
  document.getElementById("metricDataRange").textContent = currentBrand;

  // KPI card label override: "Avg Health" → "Net Final"
  const avgHealthCard = document.getElementById("metricAvgHealth").closest(".metric-card");
  if (avgHealthCard) avgHealthCard.querySelector("span").textContent = "Net Final";

  // Show brand P&L section header
  document.getElementById("brandStoresTitle").textContent = `${label} — Store P&L`;
  document.getElementById("brandStoresSubtitle").textContent =
    `${ex.totalStores} toko · ${ex.profitStores} Profit · ${ex.lossStores} Loss · ${ex.periodLabel}`;
  document.getElementById("brandStoresBadge").textContent =
    `${ex.profitStores} Profit / ${ex.lossStores} Loss`;

  // Section visibility
  _setEarSections(false);

  // EAR: show "Full Dashboard" link to access Sales + TSH + BEP data
  const fullDashBtn = document.getElementById("earFullDashBtn");
  if (fullDashBtn) fullDashBtn.style.display = currentBrand === "EAR" ? "" : "none";

  // Populate category filter
  const catSet = [...new Set(data.stores.map((s) => s.pnlCategory))].sort();
  const catSel = document.getElementById("brandFilterCat");
  catSel.innerHTML = `<option value="">Semua Tipe</option>` +
    catSet.map((c) => `<option value="${c}">${c}</option>`).join("");

  // Render P&L panel (reuse existing)
  renderPnl(data.pnl);

  // Render store table
  renderBrandStoreTable(data.stores);
}

function renderBrandStoreTable(stores) {
  const search = (document.getElementById("brandSearchStore").value || "").toLowerCase();
  const catFilter = document.getElementById("brandFilterCat").value;
  const pnlFilter = document.getElementById("brandFilterPnl").value;

  const filtered = stores.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search) && !s.code.toLowerCase().includes(search)) return false;
    if (catFilter && s.pnlCategory !== catFilter) return false;
    if (pnlFilter && s.pnl !== pnlFilter) return false;
    return true;
  });

  document.getElementById("brandTotalCount").textContent = filtered.length;
  document.getElementById("brandProfitCount").textContent = filtered.filter((s) => s.pnl === "Profit").length;
  document.getElementById("brandLossCount").textContent = filtered.filter((s) => s.pnl === "Loss").length;

  document.getElementById("brandStoreTableBody").innerHTML = filtered
    .map((s, i) => {
      const gpPct = s.netSalesPnl > 0 ? ((s.grossProfitPnl / s.netSalesPnl) * 100).toFixed(1) : "0.0";
      const pnlCls = s.pnl === "Profit" ? "positive" : s.pnl === "Loss" ? "negative" : "";
      const finalCls = s.netFinal >= 0 ? "positive" : "negative";
      return `<tr>
        <td>${i + 1}</td>
        <td><code>${s.code}</code></td>
        <td>${s.name}</td>
        <td><span class="pnl-cat-badge cat-${s.pnlCategory.toLowerCase()}">${s.pnlCategory}</span></td>
        <td><span class="${pnlCls} fw-semibold">${s.pnl}</span></td>
        <td>${formatIdrCompact(s.netSalesPnl)}</td>
        <td>${formatIdrCompact(s.grossProfitPnl)}</td>
        <td>${gpPct}%</td>
        <td>${formatIdrCompact(s.totalOpexPnl)}</td>
        <td>${formatIdrCompact(s.operatingIncomePnl)}</td>
        <td class="${finalCls} fw-semibold">${formatIdrCompact(s.netFinal)}</td>
      </tr>`;
    })
    .join("");
}

function qs(id) {
  return document.getElementById(id);
}

function formatCompactMillion(num) {
  const abs = Math.abs(num);
  if (abs >= 1000) return `${num.toFixed(1)} M`;
  if (abs >= 1) return `${num.toFixed(1)} M`;
  return `${Math.round(num * 1000)} Jt`;
}

function formatPct(value) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatIdrCompact(value) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `Rp${(value / 1_000_000_000_000).toFixed(2)} T`;
  if (abs >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)} jt`;
  return `Rp${value.toFixed(0)}`;
}

function slugDate() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function channelClass(channel) {
  return channel === "Erafone" ? "channel-erafone" : "channel-more";
}

function clusterClass(cluster) {
  return `cluster-${cluster.toLowerCase()}`;
}

function bepClass(store) {
  return getBepLabel(store) === "BEP" ? "bep-ok" : "bep-bad";
}

function getBepLabel(store) {
  return store.annualStatus || (store.bepGap >= 0 ? "BEP" : "Rugi");
}

function healthWidth(score) {
  return Math.max(8, Math.min(100, score));
}

function drawBepProgress(executive) {
  const canvas = qs("bepProgressChart");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 84;
  const lineWidth = 24;
  const total = executive.activeStores || executive.totalStores || 1;
  const segments = [
    { label: "BEP Reached", value: executive.bepReached, color: "#46b879" },
    { label: "Recovery", value: executive.clusters.Recovery, color: "#f0a839" },
    { label: "Critical", value: executive.clusters.Critical, color: "#de5a52" },
  ];

  ctx.clearRect(0, 0, width, height);
  let start = -Math.PI / 2;

  segments.forEach((segment) => {
    const angle = (segment.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.strokeStyle = segment.color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();
    start += angle + 0.04;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "#e6edf5";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#46b879";
  ctx.font = "bold 36px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round((executive.bepReached / total) * 100)}%`, cx, cy + 6);
  ctx.fillStyle = "#7a8697";
  ctx.font = "18px Inter, system-ui, sans-serif";
  ctx.fillText("BEP Reached", cx, cy + 34);
  ctx.textAlign = "left";

  qs("bepLegend").innerHTML = segments
    .map(
      (segment) => `
        <div class="legend-item">
          <div><span class="legend-dot" style="background:${segment.color}"></span><strong>${segment.label}</strong></div>
          <span>${segment.value} toko</span>
        </div>
      `,
    )
    .join("");
}

function renderExecutive(data) {
  const { executive, actions } = data;
  qs("metricTotalStores").textContent = executive.totalStores;
  qs("metricTotalStoresNote").textContent = executive.totalStoresNote || `${executive.activeStores} toko aktif`;
  qs("metricBepReached").textContent = executive.bepReached;
  qs("metricBepReachedNote").textContent =
    executive.bepReachedNote || `${Math.round((executive.bepReached / executive.activeStores) * 100)}% dari toko aktif`;
  qs("metricBelowBep").textContent = executive.belowBep;
  qs("metricBelowBepNote").textContent = executive.belowBepNote || "Perlu perhatian khusus";
  qs("metricRevenue2025").textContent = executive.revenue2025;
  qs("metricRevenue2025Note").textContent = executive.revenue2025Note || "Net Amount (IDR)";
  qs("metricYoy").textContent = `${executive.yoy > 0 ? "+" : ""}${executive.yoy}%`;
  qs("metricYoyNote").textContent = executive.yoyNote || "2024 ke 2025";
  qs("metricAvgHealth").textContent = executive.avgHealth;
  qs("metricDataPeriod").textContent = executive.dataPeriod;
  qs("metricDataRange").textContent = executive.dataRange;
  qs("executiveSummarySubtitle").textContent = executive.summarySubtitle || "Kondisi Region 5";
  qs("heroDataPeriod").textContent = executive.dataPeriod;
  qs("heroDataNote").textContent = executive.summaryTitle;

  qs("clusterGrowthCount").textContent = executive.clusters.Growth;
  qs("clusterStableCount").textContent = executive.clusters.Stable;
  qs("clusterRecoveryCount").textContent = executive.clusters.Recovery;
  qs("clusterCriticalCount").textContent = executive.clusters.Critical;

  qs("executiveSummaryTitle").textContent = executive.summaryTitle;
  qs("executiveCondition").textContent = executive.condition;
  qs("executiveAnalysis").textContent = executive.analysis;
  qs("executiveAction").textContent = executive.action;

  qs("actionZoneList").innerHTML = actions
    .map(
      (item) => `
        <div class="action-item">
          <strong>${item.title}</strong>
          <p>${item.note}</p>
          <span class="action-meta">${item.tag}</span>
        </div>
      `,
    )
    .join("");

  drawBepProgress(executive);
}

function renderImportStatus(data) {
  const source = data.source || {};
  const active = source.salesWorkbookActive || source.salesWorkbook || "-";
  const generated = source.generatedAt || "-";
  qs("activeSalesSource").textContent = active;
  qs("generatedAtValue").textContent = generated.replace("T", " ");
  if (!qs("importStatusValue").textContent.trim()) {
    qs("importStatusValue").textContent = "Siap import";
  }
}

function updateUploadButton() {
  qs("uploadExcelButton").textContent = selectedUpload ? "Import File Terpilih" : "1-Click Import Latest Sales";
}

function setActiveTab(targetId) {
  document.querySelectorAll(".tab-strip .tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.target === targetId);
  });
}

function scrollToSection(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  setActiveTab(targetId);
}

function exportCurrentReport() {
  const data = dashboardState;
  if (!data) return;
  const executive = data.executive || {};
  const pnl = data.pnl || {};
  const actions = data.actions || [];
  const topCritical = data.topCritical || [];

  const html = `<!doctype html>
  <html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>ERA-ANALYTICS Region 5 Report</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #1f2937; }
      h1,h2,h3 { margin: 0 0 12px; }
      .muted { color: #6b7280; margin-bottom: 20px; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; margin-bottom: 24px; }
      .card { border: 1px solid #dbe4ef; border-radius: 8px; padding: 16px; }
      .kpi { font-size: 28px; font-weight: 700; margin-top: 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }
      th { font-size: 12px; text-transform: uppercase; color: #6b7280; }
      ul { padding-left: 18px; }
    </style>
  </head>
  <body>
    <h1>ERA-ANALYTICS Region 5 Report</h1>
    <div class="muted">Generated ${new Date().toLocaleString("id-ID")} · Data period ${executive.dataPeriod || "-"}</div>
    <div class="grid">
      <div class="card"><div>Total Toko</div><div class="kpi">${executive.totalStores || 0}</div><div>${executive.totalStoresNote || ""}</div></div>
      <div class="card"><div>BEP Reached</div><div class="kpi">${executive.bepReached || 0}</div><div>${executive.bepReachedNote || ""}</div></div>
      <div class="card"><div>Below BEP</div><div class="kpi">${executive.belowBep || 0}</div><div>${executive.belowBepNote || ""}</div></div>
      <div class="card"><div>Revenue 2025</div><div class="kpi">${executive.revenue2025 || "-"}</div><div>${executive.revenue2025Note || ""}</div></div>
    </div>
    <div class="card">
      <h2>Executive Summary</h2>
      <p><b>Kondisi:</b> ${executive.condition || "-"}</p>
      <p><b>Analisis:</b> ${executive.analysis || "-"}</p>
      <p><b>Tindakan:</b> ${executive.action || "-"}</p>
    </div>
    <div class="grid">
      <div class="card">
        <h2>Action Zone</h2>
        <ul>${actions.map((item) => `<li><b>${item.title}</b>: ${item.note}</li>`).join("")}</ul>
      </div>
      <div class="card">
        <h2>P&L Summary</h2>
        <p><b>Net Sales:</b> ${formatIdrCompact(pnl.grand?.netSales || 0)}</p>
        <p><b>Gross Profit:</b> ${formatIdrCompact(pnl.grand?.grossProfit || 0)}</p>
        <p><b>Operating Income:</b> ${formatIdrCompact(pnl.grand?.operatingIncome || 0)}</p>
        <p><b>Net Final:</b> ${formatIdrCompact(pnl.grand?.netFinal || 0)}</p>
      </div>
    </div>
    <div class="card">
      <h2>Critical Store Watchlist</h2>
      <table>
        <thead><tr><th>Kode</th><th>Store</th><th>TSH</th><th>Gap BEP</th><th>P&L</th></tr></thead>
        <tbody>
          ${topCritical.map((store) => `<tr><td>${store.code}</td><td>${store.name}</td><td>${store.tsh}</td><td>${formatIdrCompact(store.bepGap)}</td><td>${store.pnl}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  </body>
  </html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ERA_ANALYTICS_Region5_Report_${slugDate()}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportBotData() {
  const data = dashboardState;
  if (!data) {
    alert("Belum ada data. Jalankan import data terlebih dahulu.");
    return;
  }

  const generatedAt = new Date().toISOString();
  const stores = (data.stores || []).filter(s => s.status === "Aktif");

  // 1. stores-pl.json
  const storesPL = {
    generated_at: generatedAt,
    data_period: data.executive?.dataPeriod || "-",
    region: "Region 5",
    stores: stores.map(s => ({
      store_id: s.code,
      store_name: s.name,
      brand: s.channel,
      revenue: s.latestPeriodSales || 0,
      net_profit: s.netFinal || 0,
      profit_status: (s.pnl || "").toLowerCase() === "profit" ? "PROFIT" : "LOSS",
      ach_percent: s.bep_ach != null ? Math.round(s.bep_ach * 1000) / 10 : null,
      cluster: s.cluster,
      health: s.health,
    })),
  };

  // 2. summary.json
  const profitCount = stores.filter(s => (s.pnl || "").toLowerCase() === "profit").length;
  const pnlGrand = data.pnl?.grand || {};
  const exec = data.executive || {};
  const summary = {
    generated_at: generatedAt,
    data_period: exec.dataPeriod || "-",
    region: "Region 5",
    total_stores: exec.totalStores || 0,
    active_stores: exec.activeStores || 0,
    profit_stores: profitCount,
    loss_stores: stores.length - profitCount,
    bep_reached: exec.annualBepReached ?? exec.bepReached ?? 0,
    below_bep: exec.annualBelowBep ?? exec.belowBep ?? 0,
    avg_health: exec.avgHealth || 0,
    total_net_sales: pnlGrand.netSales || 0,
    total_gross_profit: pnlGrand.grossProfit || 0,
    total_net_profit: pnlGrand.netFinal || 0,
    clusters: exec.clusters || {},
  };

  // 3. clusters.json
  const clusterMap = {};
  stores.forEach(s => {
    if (!clusterMap[s.cluster]) clusterMap[s.cluster] = [];
    clusterMap[s.cluster].push(s.code);
  });
  const clusters = {
    generated_at: generatedAt,
    data_period: exec.dataPeriod || "-",
    region: "Region 5",
    clusters: clusterMap,
  };

  [
    ["stores-pl.json", storesPL],
    ["summary.json", summary],
    ["clusters.json", clusters],
  ].forEach(([filename, payload]) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  alert("✅ 3 file JSON berhasil diunduh (stores-pl.json, summary.json, clusters.json).\nUpload ke folder /public/data/ di repo ERA-ANALYTICS lalu push ke main.");
}

function renderTshSection(data) {
  const stats = data.tshStats;
  const totalLossTsh = stats.filter((item) => item.lossOperational > 0 || item.loss > 0).length;
  const avgBep = Math.round((stats.reduce((sum, item) => sum + item.bep / Math.max(item.stores, 1), 0) / (stats.length || 1)) * 100);

  qs("tshPerformanceSubtitle").textContent = "Historical annual resmi per TSH + health operasional toko aktif";
  qs("tshRevenueSubtitle").textContent = "Revenue 2025 resmi dari workbook summary Region 5";

  qs("tshMiniKpis").innerHTML = `
    <article class="mini-kpi"><span>Total TSH</span><strong>${stats.length}</strong><small>Sumber: summary resmi</small></article>
    <article class="mini-kpi"><span>TSH Ada Loss Store</span><strong>${totalLossTsh}</strong><small>Annual atau operational loss</small></article>
    <article class="mini-kpi"><span>Avg Annual BEP Rate</span><strong>${avgBep}%</strong><small>Dari 163 toko 2022-2026</small></article>
    <article class="mini-kpi"><span>Top Owner</span><strong>${stats[0]?.tsh || "-"}</strong><small>Revenue 2025 tertinggi</small></article>
  `;

  const maxRevenue = Math.max(...stats.map((item) => item.total2025), 1);
  qs("tshRevenueBars").innerHTML = stats
    .slice(0, 6)
    .map(
      (item, index) => `
        <div class="rank-row">
          <div class="rank-index">${index + 1}</div>
          <div class="rank-copy">
            <strong>${item.tsh}</strong>
            <small>${item.stores} toko annual · ${item.lossOperational} loss aktif</small>
            <div class="bar-track"><i style="width:${(item.total2025 / maxRevenue) * 100}%"></i></div>
          </div>
          <strong>${(item.total2025 / 1_000_000_000).toFixed(1)} M</strong>
        </div>
      `,
    )
    .join("");

  qs("tshPerformanceList").innerHTML = stats
    .map(
          (item) => `
        <div class="tsh-row">
          <div class="tsh-main">
            <strong>${item.tsh}</strong>
            <small>${item.stores} toko · annual ${item.bep} BEP / ${item.loss} rugi · aktif ${item.activeStores}</small>
          </div>
          <div class="tsh-metric"><strong>${(item.total2025 / 1_000_000_000).toFixed(1)} M</strong><small>Revenue 2025</small></div>
          <div class="tsh-metric"><strong>${item.avgHealth.toFixed(0)}</strong><small>Avg health</small></div>
          <div class="tsh-metric"><strong>${Math.round((item.bep / Math.max(item.stores, 1)) * 100)}%</strong><small>Annual BEP rate</small></div>
        </div>
      `,
    )
    .join("");

  qs("tshWatchlist").innerHTML = stats
    .filter((item) => item.lossOperational > 1 || item.avgHealth < 65 || item.loss > 3)
    .slice(0, 5)
    .map(
      (item) => `
        <div class="watch-card">
          <strong>${item.tsh}</strong>
          <p>Annual rugi ${item.loss} · loss aktif ${item.lossOperational} · avg health ${item.avgHealth.toFixed(0)} · revenue 2025 ${(item.total2025 / 1_000_000_000).toFixed(1)} M</p>
        </div>
      `,
    )
    .join("");
}

function populateFilters(stores) {
  const tshs = ["Semua TSH", ...new Set(stores.map((store) => store.tsh).filter((tsh) => tsh && tsh !== "Close"))];
  const channels = ["Semua Channel", ...new Set(stores.map((store) => store.channel))];
  const clusters = ["Semua Cluster", ...new Set(stores.map((store) => store.cluster))];
  const statuses = ["Semua Status", "BEP", "RUGI"];

  qs("filterTsh").innerHTML = tshs.map((item) => `<option value="${item}">${item}</option>`).join("");
  qs("filterChannel").innerHTML = channels.map((item) => `<option value="${item}">${item}</option>`).join("");
  qs("filterCluster").innerHTML = clusters.map((item) => `<option value="${item}">${item}</option>`).join("");
  qs("filterStatus").innerHTML = statuses.map((item) => `<option value="${item}">${item}</option>`).join("");
  qs("aiStoreSelect").innerHTML = stores
    .filter((store) => store.status === "Aktif")
    .slice()
    .sort((a, b) => a.bepGap - b.bepGap)
    .map((store) => `<option value="${store.code}">${store.code} - ${store.name}</option>`)
    .join("");
}

function getFilteredStores() {
  const stores = dashboardState.stores.filter((store) => store.tsh !== "Close");
  const search = qs("searchStore").value.trim().toLowerCase();
  const tsh = qs("filterTsh").value;
  const channel = qs("filterChannel").value;
  const cluster = qs("filterCluster").value;
  const status = qs("filterStatus").value;
  const sort = qs("sortStore").value;

  const filtered = stores.filter((store) => {
    const bySearch =
      !search ||
      store.name.toLowerCase().includes(search) ||
      store.code.toLowerCase().includes(search);
    const byTsh = tsh === "Semua TSH" || store.tsh === tsh;
    const byChannel = channel === "Semua Channel" || store.channel === channel;
    const byCluster = cluster === "Semua Cluster" || store.cluster === cluster;
    const byStatus = status === "Semua Status" || (getBepLabel(store) || "").toUpperCase() === status;
    return bySearch && byTsh && byChannel && byCluster && byStatus;
  });

  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    health: (a, b) => b.health - a.health,
    yoy: (a, b) => b.yoy - a.yoy,
    bep: (a, b) => (b.bepGap >= 0) - (a.bepGap >= 0) || a.bepGap - b.bepGap,
  };

  return filtered.sort(sorters[sort] || sorters.name);
}

function renderStoreTable() {
  const filtered = getFilteredStores();

  qs("dataTokoSubtitle").textContent =
    "163 toko summary 2022-2026 + cluster/health operasional dari Sales vs Stock dan P&L";

  qs("filteredTotalCount").textContent = filtered.length;
  qs("filteredBepCount").textContent = filtered.filter((store) => getBepLabel(store) === "BEP").length;
  qs("filteredBelowCount").textContent = filtered.filter((store) => getBepLabel(store) === "RUGI").length;
  qs("filteredCriticalCount").textContent = filtered.filter((store) => store.cluster === "Critical").length;

  qs("storeTableBody").innerHTML = filtered
    .map(
      (store, index) => `
        <tr data-store-code="${store.code}">
          <td>${index + 1}</td>
          <td>${store.code}</td>
          <td><strong>${store.name}</strong></td>
          <td><span class="channel-tag ${channelClass(store.channel)}">${store.channel}</span></td>
          <td>${store.tsh}</td>
          <td><span class="cluster-tag ${clusterClass(store.cluster)}">${store.cluster}</span></td>
          <td>
            <div class="health-cell">
              <span class="health-score">${store.health}</span>
              <div class="health-mini"><i style="width:${healthWidth(store.health)}%"></i></div>
            </div>
          </td>
          <td>${formatCompactMillion(store.sales.y2022 / 1_000_000_000)}</td>
          <td>${formatCompactMillion(store.sales.y2023 / 1_000_000_000)}</td>
          <td>${formatCompactMillion(store.sales.y2024 / 1_000_000_000)}</td>
          <td>${formatCompactMillion(store.sales.y2025 / 1_000_000_000)}</td>
          <td>${formatCompactMillion(store.sales.y2026 / 1_000_000_000)}</td>
          <td><strong>${(store.annualTotal / 1_000_000_000).toFixed(1)} M</strong></td>
          <td class="${store.yoy >= 0 ? "positive" : "negative"}">${formatPct(store.yoy)}</td>
          <td><span class="bep-tag ${bepClass(store)}">${getBepLabel(store)}</span></td>
          <td><button class="detail-link" onclick="openStoreDetail('${store.code}')" style="cursor:pointer;background:none;border:none;font-family:inherit;font-size:inherit;padding:0;">Detail →</button></td>
        </tr>
      `,
    )
    .join("");
}

function renderBepTracker() {
  const stores = dashboardState.stores.filter((store) => store.status === "Aktif");
  const groups = [
    {
      title: "Sudah Aman",
      note: "Store yang sudah konsisten di atas BEP",
      items: stores.filter((store) => store.bepGap >= 0 && store.cluster !== "Recovery").slice(0, 4),
    },
    {
      title: "Recovery",
      note: "Store yang mulai membaik tetapi belum konsisten",
      items: stores.filter((store) => store.cluster === "Recovery").slice(0, 4),
    },
    {
      title: "Critical Gap",
      note: "Store dengan gap BEP paling besar",
      items: stores.slice().sort((a, b) => a.bepGap - b.bepGap).slice(0, 4),
    },
  ];

  qs("bepTrackerList").innerHTML = groups
    .map(
      (group) => `
        <div class="tracker-card">
          <strong>${group.title}</strong>
          <p>${group.note}</p>
          ${group.items
            .map(
              (store) =>
                `<div class="tracker-top"><span>${store.name}</span><b>${store.bepGap > 0 ? "+" : ""}${formatIdrCompact(store.bepGap)}</b></div>`,
            )
            .join("")}
        </div>
      `,
    )
    .join("");

  qs("criticalStoreCards").innerHTML = dashboardState.topCritical
    .map(
      (store) => `
        <div class="critical-card" data-store-code="${store.code}">
          <div class="critical-top">
            <strong>${store.name}</strong>
            <span class="cluster-tag cluster-critical">Critical</span>
          </div>
          <p>${store.tsh} · ${store.channel} · gap ${formatIdrCompact(store.bepGap)}</p>
        </div>
      `,
    )
    .join("");
}

function renderPnl(pnl) {
  const grand = pnl.grand;
  const profitCount = dashboardState.stores.filter((store) => store.pnl === "Profit").length;
  const lossCount = dashboardState.stores.filter((store) => store.pnl === "Loss").length;
  const total = Math.max(profitCount + lossCount, 1);
  const analysis = pnl.analysis || {};
  const topProfit = analysis.topProfit;
  const topLoss = analysis.topLoss;

  qs("pnlPeriodLabel").textContent = pnl.periodLabel;
  qs("pnlLossBadge").textContent = `${lossCount} Loss Stores`;
  qs("pnlNetSales").textContent = formatIdrCompact(grand.netSales);
  const kemitraanNote = pnl.kemitraanNetFinal != null ? ` · Kemitraan ${formatIdrCompact(pnl.kemitraanNetFinal)}` : "";
  qs("pnlNetSalesNote").textContent = `Erafone final ${formatIdrCompact(pnl.erafoneNetFinal)} · ERA & More ${formatIdrCompact(pnl.eraMoreNetFinal)}${kemitraanNote}`;
  qs("pnlGrossProfit").textContent = formatIdrCompact(grand.grossProfit);
  qs("pnlGrossProfitNote").textContent = `GP ${(grand.gpPct * 100).toFixed(1)}%`;
  qs("pnlOperatingIncome").textContent = formatIdrCompact(grand.operatingIncome);
  qs("pnlNetFinal").textContent = formatIdrCompact(grand.netFinal);
  qs("pnlNetFinal").className = grand.netFinal >= 0 ? "positive" : "negative";
  qs("pnlProfitCount").textContent = profitCount;
  qs("pnlLossCount").textContent = lossCount;
  qs("pnlProfitBar").style.width = `${(profitCount / total) * 100}%`;
  qs("pnlLossBar").style.width = `${(lossCount / total) * 100}%`;
  qs("pnlCostDrivers").innerHTML = pnl.costDrivers
    .map(([name, value]) => `<span>${name} <b>${formatIdrCompact(value)}</b></span>`)
    .join("");
  qs("pnlAnalysisSummary").innerHTML = `
    <span>Total analysis <b>${analysis.grand?.regionTotal || 0} toko</b></span>
    <span>Top profit pattern <b>${topProfit ? topProfit.regionTotal : 0} toko</b></span>
    <span>Top loss pattern <b>${topLoss ? topLoss.regionTotal : 0} toko</b></span>
    <span>Mall vs Street <b>${analysis.grand?.mallTotal || 0} / ${analysis.grand?.streetTotal || 0}</b></span>
    ${topProfit ? `<span>Profit dominan <b>${topProfit.remark.replace("This store is ", "").replace("because their ", "")}</b></span>` : ""}
    ${topLoss ? `<span>Loss dominan <b>${topLoss.remark.replace("This store is ", "").replace("because their ", "")}</b></span>` : ""}
  `;
}

function buildAiInsight(store) {
  const rootCause =
    store.tsh === "VACANT"
      ? {
          title: "Ownership gap",
          copy: "Toko belum punya owner lapangan yang stabil, sehingga cadence review dan tindakan pemulihan belum konsisten.",
          confidence: "Medium",
        }
      : store.bepGap < -1_000_000_000 && store.netFinal < 0
        ? {
            title: "Traffic lemah + cost terlalu berat",
            copy: "Gap BEP masih besar dan P&L final masih negatif. Fokus awal harus ke traffic harian dan evaluasi cost structure toko.",
            confidence: "High",
          }
        : store.cluster === "Critical"
          ? {
              title: "Conversion dan attach rate belum cukup",
              copy: "Store masih device-heavy dan belum punya dorongan bundle, accessories, atau repair contract yang cukup kuat.",
              confidence: "High",
            }
          : {
              title: "Store sehat perlu dijaga",
              copy: "Store sudah relatif sehat. Berikutnya fokus menjaga mix, margin, dan konsistensi owner agar tidak turun kembali.",
              confidence: "Medium",
            };

  const action =
    store.tsh === "VACANT"
      ? {
          title: "Assign owner + weekly action list",
          copy: "Tunjuk PIC sementara, review manpower, lalu jalankan cadence review 7 hari untuk menutup gap paling besar.",
        }
      : store.bepGap < -1_000_000_000
        ? {
            title: "Review cost + dorong traffic lokal",
            copy: "Mulai dari traffic lokal, GBP, WA blast, event toko, lalu validasi format/lease jika 90 hari belum membaik.",
          }
        : store.cluster === "Critical"
          ? {
              title: "Naikkan conversion + bundle attach",
              copy: "Dorong script closing, paket accessories, repair contract, dan stok fast-moving yang lebih disiplin.",
            }
          : {
              title: "Protect best practice",
              copy: "Jadikan store ini benchmark TSH lain dan pertahankan kesehatan toko dengan review rutin.",
            };

  return {
    headline: `${store.name} ${store.bepGap >= 0 ? "cukup sehat" : "menjadi prioritas"} dengan health ${store.health} dan gap BEP ${formatIdrCompact(store.bepGap)}.`,
    summary: `${store.channel} dipegang ${store.tsh}. Annual status ${store.annualStatus}, revenue 2025 ${formatIdrCompact(store.sales.y2025)}, dan P&L final ${formatIdrCompact(store.netFinal)}. AI membaca summary history lalu menggabungkannya dengan BEP, cluster, health, dan profitabilitas operasional untuk menentukan prioritas action.`,
    rootCause,
    action,
  };
}

function renderAi(store) {
  const insight = buildAiInsight(store);
  const question = qs("aiQuestion") && qs("aiQuestion").value.trim();
  qs("aiHeadline").textContent = insight.headline;
  qs("aiSummary").textContent = question
    ? `Pertanyaan: "${question}" — ${insight.summary}`
    : insight.summary;
  qs("aiConfidence").textContent = insight.rootCause.confidence;
  qs("aiPriorityStore").textContent = `${store.code} - ${store.name}`;
  qs("aiPriorityCopy").textContent = `${store.tsh} · ${store.channel} · status ${getBepLabel(store)} · P&L ${store.pnl}`;
  qs("aiRootCauseTitle").textContent = insight.rootCause.title;
  qs("aiRootCauseCopy").textContent = insight.rootCause.copy;
  qs("aiActionTitle").textContent = insight.action.title;
  qs("aiActionCopy").textContent = insight.action.copy;
  if (!qs("aiQuestion").value.trim()) {
    qs("aiQuestion").placeholder = `Kenapa ${store.name} ${store.bepGap >= 0 ? "harus dijaga" : "masih rugi"} dan action apa yang harus dilakukan?`;
  }
}

function bindEvents() {
  if (listenersBound) return;
  listenersBound = true;

  // Brand switcher — onclick handled inline in HTML for mobile compatibility

  // Brand P&L store filters
  ["brandSearchStore", "brandFilterCat", "brandFilterPnl"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => dashboardState && renderBrandStoreTable(dashboardState.stores));
      el.addEventListener("change", () => dashboardState && renderBrandStoreTable(dashboardState.stores));
    }
  });

  ["searchStore", "filterTsh", "filterChannel", "filterCluster", "filterStatus", "sortStore"].forEach((id) => {
    qs(id).addEventListener("input", renderStoreTable);
    qs(id).addEventListener("change", renderStoreTable);
  });

  qs("resetFilters").addEventListener("click", () => {
    qs("searchStore").value = "";
    qs("filterTsh").selectedIndex = 0;
    qs("filterChannel").selectedIndex = 0;
    qs("filterCluster").selectedIndex = 0;
    qs("filterStatus").selectedIndex = 0;
    qs("sortStore").value = "name";
    renderStoreTable();
  });

  qs("storeTableBody").addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-store-code]");
    if (!row) return;
    const store = dashboardState.stores.find((item) => item.code === row.dataset.storeCode);
    if (store) {
      qs("aiStoreSelect").value = store.code;
      renderAi(store);
      window.location.hash = "#ai-insights";
    }
  });

  qs("criticalStoreCards").addEventListener("click", (event) => {
    const card = event.target.closest("[data-store-code]");
    if (!card) return;
    const store = dashboardState.stores.find((item) => item.code === card.dataset.storeCode);
    if (store) {
      qs("aiStoreSelect").value = store.code;
      renderAi(store);
      window.location.hash = "#ai-insights";
    }
  });

  qs("aiStoreSelect").addEventListener("change", (event) => {
    const store = dashboardState.stores.find((item) => item.code === event.target.value);
    if (store) renderAi(store);
  });

  qs("aiGenerateButton").addEventListener("click", () => {
    const store = dashboardState.stores.find((item) => item.code === qs("aiStoreSelect").value);
    if (!store) {
      alert("Pilih toko terlebih dahulu dari dropdown.");
      return;
    }
    const btn = qs("aiGenerateButton");
    btn.disabled = true;
    btn.textContent = "Menganalisis...";
    qs("aiHeadline").textContent = "Sedang menganalisis data toko...";
    qs("aiSummary").textContent = "AI sedang membaca BEP, cluster, health, trend, dan pola OPEX toko yang dipilih.";
    setTimeout(() => {
      renderAi(store);
      btn.disabled = false;
      btn.textContent = "Generate Insight";
      btn.style.boxShadow = "0 0 0 3px rgba(229,75,69,0.35)";
      setTimeout(() => { btn.style.boxShadow = ""; }, 1200);
      const ts = new Date().toLocaleString("id-ID", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
      const lg = qs("aiLastGenerated");
      if (lg) lg.textContent = `Terakhir dianalisis: ${ts} · Toko: ${store.code} — ${store.name}`;
    }, 900);
  });

  qs("uploadExcelButton").addEventListener("click", () => {
    const formData = new FormData();
    if (selectedUpload) {
      formData.append("file", selectedUpload);
    }
    qs("uploadExcelButton").disabled = true;
    qs("importStatusValue").textContent = selectedUpload ? "Importing file terpilih..." : "Importing latest sales...";

    fetch(importUrl, {
      method: "POST",
      body: formData,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Import gagal.");
        }
        qs("importStatusValue").textContent = `Sukses: ${payload.filename}`;
        return fetch(`${EAR_FULL_URL}?t=${Date.now()}`).then((res) => res.json());
      })
      .then((data) => {
        renderAll(data);
        selectedUpload = null;
        qs("uploadExcelInput").value = "";
        qs("selectedUploadFile").textContent = "Belum ada";
        updateUploadButton();
        window.location.hash = "#dashboard";
      })
      .catch((error) => {
        qs("importStatusValue").textContent = `Gagal: ${error.message}`;
      })
      .finally(() => {
        qs("uploadExcelButton").disabled = false;
      });
  });

  qs("uploadExcelInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    selectedUpload = file;
    qs("selectedUploadFile").textContent = file.name;
    qs("importStatusValue").textContent = "File siap di-import";
    updateUploadButton();
    window.location.hash = "#daily-import";
  });

  qs("selectedUploadFile").closest("span")?.addEventListener("click", () => {
    qs("uploadExcelInput").click();
  });

  document.querySelectorAll(".tab-strip .tab").forEach((button) => {
    button.addEventListener("click", () => {
      scrollToSection(button.dataset.target);
    });
  });

  qs("exportReportButton").addEventListener("click", () => {
    exportCurrentReport();
  });

  const exportBotBtn = document.getElementById("exportBotButton");
  if (exportBotBtn) {
    exportBotBtn.addEventListener("click", () => {
      exportBotData();
    });
  }
}

function renderAll(data) {
  dashboardState = data;
  // Restore EAR-specific sections + KPI card labels
  _setEarSections(true);
  const avgHealthCard = document.getElementById("metricAvgHealth").closest(".metric-card");
  if (avgHealthCard) avgHealthCard.querySelector("span").textContent = "Avg Health";

  renderExecutive(data);
  renderImportStatus(data);
  renderTshSection(data);
  populateFilters(data.stores);
  renderStoreTable();
  renderBepTracker();
  renderPnl(data.pnl);
  const defaultStore = data.topCritical[0] || data.stores.find((store) => store.status === "Aktif");
  if (defaultStore) {
    qs("aiStoreSelect").value = defaultStore.code;
    renderAi(defaultStore);
  }
  updateUploadButton();
  bindEvents();
}

fetch(BRAND_URLS.EAR)
  .then((response) => {
    if (!response.ok) throw new Error("Dashboard data not found");
    return response.json();
  })
  .then((data) => {
    dashboardState = data;
    renderBrandView(data);
    bindEvents();
  })
  .catch(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<div style="padding:12px;background:#ffe7e7;color:#9d2323;font-weight:700">Dashboard data belum terbaca. Jalankan parser data lebih dulu.</div>',
    );
  });

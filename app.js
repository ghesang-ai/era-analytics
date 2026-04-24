const dashboardDataUrl = "./outputs/dashboard_data_v2.json";

let dashboardState = null;

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
  qs("metricYoyNote").textContent = "2024 ke 2025";
  qs("metricAvgHealth").textContent = executive.avgHealth;
  qs("metricDataPeriod").textContent = executive.dataPeriod;
  qs("metricDataRange").textContent = executive.dataRange;
  qs("executiveSummarySubtitle").textContent = executive.summarySubtitle || "Kondisi Region 5";

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
  const tshs = ["Semua TSH", ...new Set(stores.map((store) => store.tsh))];
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
  const stores = dashboardState.stores;
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
          <td><a class="detail-link" href="#ai-insights">Detail →</a></td>
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
  const profitCount = dashboardState.stores.filter((store) => store.status === "Aktif" && store.pnl === "Profit").length;
  const lossCount = dashboardState.stores.filter((store) => store.status === "Aktif" && store.pnl === "Loss").length;
  const total = Math.max(profitCount + lossCount, 1);

  qs("pnlPeriodLabel").textContent = pnl.periodLabel;
  qs("pnlLossBadge").textContent = `${lossCount} Loss Stores`;
  qs("pnlNetSales").textContent = formatIdrCompact(grand.netSales);
  qs("pnlNetSalesNote").textContent = `Erafone final ${formatIdrCompact(pnl.erafoneNetFinal)} · ERA & More ${formatIdrCompact(pnl.eraMoreNetFinal)}`;
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
  qs("aiHeadline").textContent = insight.headline;
  qs("aiSummary").textContent = insight.summary;
  qs("aiConfidence").textContent = insight.rootCause.confidence;
  qs("aiPriorityStore").textContent = `${store.code} - ${store.name}`;
  qs("aiPriorityCopy").textContent = `${store.tsh} · ${store.channel} · status ${getBepLabel(store)} · P&L ${store.pnl}`;
  qs("aiRootCauseTitle").textContent = insight.rootCause.title;
  qs("aiRootCauseCopy").textContent = insight.rootCause.copy;
  qs("aiActionTitle").textContent = insight.action.title;
  qs("aiActionCopy").textContent = insight.action.copy;
  qs("aiQuestion").value = `Kenapa ${store.name} ${store.bepGap >= 0 ? "harus dijaga" : "masih rugi"} dan action apa yang harus dilakukan?`;
}

function bindEvents() {
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
    if (store) renderAi(store);
  });

  qs("uploadExcelButton").addEventListener("click", () => {
    qs("uploadExcelInput").click();
  });

  qs("uploadExcelInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    qs("selectedUploadFile").textContent = file.name;
    window.location.hash = "#daily-import";
  });
}

function renderAll(data) {
  dashboardState = data;
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
  bindEvents();
}

fetch(dashboardDataUrl)
  .then((response) => {
    if (!response.ok) throw new Error("Dashboard data not found");
    return response.json();
  })
  .then(renderAll)
  .catch(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<div style="padding:12px;background:#ffe7e7;color:#9d2323;font-weight:700">Dashboard data belum terbaca. Jalankan parser data lebih dulu.</div>',
    );
  });

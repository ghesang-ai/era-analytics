const summaryUrl = "./outputs/era_analysis_summary.json";

const categoryMix = [
  ["Device", 420847078617],
  ["Accessories", 20250543767],
  ["Operator", 11882441083],
  ["Repair Contract", 8888065706],
  ["Laptop", 5537836931],
  ["CE", 3153165300],
];

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const pct = new Intl.NumberFormat("id-ID", {
  style: "percent",
  maximumFractionDigits: 1,
});

const plainPct = (value) => `${(value * 100).toFixed(1).replace(".", ",")}%`;

function formatRp(value) {
  return rupiah.format(value).replace("IDR", "Rp");
}

function qs(id) {
  return document.getElementById(id);
}

function drawBarChart(canvas, labels, values, color = "#087b83") {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const max = Math.max(...values) * 1.15;
  const padding = { top: 24, right: 24, bottom: 48, left: 74 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barGap = 18;
  const barWidth = (chartWidth - barGap * (values.length - 1)) / values.length;

  ctx.strokeStyle = "#dce2e8";
  ctx.lineWidth = 1;
  ctx.font = "20px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#66717d";

  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + chartHeight - (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  values.forEach((value, index) => {
    const x = padding.left + index * (barWidth + barGap);
    const barHeight = (value / max) * chartHeight;
    const y = padding.top + chartHeight - barHeight;

    ctx.fillStyle = color;
    roundRect(ctx, x, y, barWidth, barHeight, 8);
    ctx.fill();

    ctx.fillStyle = "#151a1f";
    ctx.font = "bold 20px Inter, system-ui, sans-serif";
    ctx.fillText(labels[index], x + 4, height - 18);

    ctx.fillStyle = "#66717d";
    ctx.font = "18px Inter, system-ui, sans-serif";
    ctx.fillText(formatRp(value), x, y - 8);
  });
}

function drawDonut(canvas, entries, colors) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 22;
  const total = entries.reduce((sum, item) => sum + item[1], 0);
  let start = -Math.PI / 2;

  entries.forEach((entry, index) => {
    const angle = (entry[1] / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();
    start += angle;
  });

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.fillStyle = "#151a1f";
  ctx.font = "bold 28px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("89,4%", cx, cy - 4);
  ctx.fillStyle = "#66717d";
  ctx.font = "18px Inter, system-ui, sans-serif";
  ctx.fillText("Device", cx, cy + 24);
  ctx.textAlign = "start";
}

function drawHealth(canvas, counts) {
  const labels = ["Above BEP", "Below BEP", "Critical", "No BEP"];
  const values = labels.map((label) => counts[label] || 0);
  const colors = ["#16825d", "#ba7a13", "#c43d3d", "#2866b1"];
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const max = Math.max(...values) * 1.2;
  const padding = { top: 20, right: 24, bottom: 46, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barHeight = 34;
  const gap = 22;

  labels.forEach((label, index) => {
    const y = padding.top + index * (barHeight + gap);
    const barWidth = (values[index] / max) * chartWidth;

    ctx.fillStyle = "#edf1f4";
    roundRect(ctx, padding.left, y, chartWidth, barHeight, 8);
    ctx.fill();
    ctx.fillStyle = colors[index];
    roundRect(ctx, padding.left, y, barWidth, barHeight, 8);
    ctx.fill();

    ctx.fillStyle = "#151a1f";
    ctx.font = "bold 20px Inter, system-ui, sans-serif";
    ctx.fillText(label, padding.left, y + barHeight + 19);
    ctx.fillStyle = "#66717d";
    ctx.fillText(`${values[index]} stores`, width - padding.right - 100, y + 24);
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function renderTshBars(tshList) {
  const activeTsh = tshList
    .filter((item) => item[0] !== "Close")
    .sort((a, b) => b[4] - a[4])
    .slice(0, 8);
  const max = Math.max(...activeTsh.map((item) => item[4]));
  qs("tshBars").innerHTML = activeTsh
    .map((item) => {
      const width = Math.max(8, (item[4] / max) * 100);
      return `
        <div class="bar-row">
          <div class="bar-label" title="${item[0]}">${item[0]}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          <div class="bar-value">${plainPct(item[4])}</div>
        </div>
      `;
    })
    .join("");
}

function renderStoreRows(stores) {
  const rows = stores
    .filter((store) => store.status === "Aktif" && store.bep > 0)
    .sort((a, b) => a.mar26 - a.bep - (b.mar26 - b.bep))
    .slice(0, 10);

  qs("storeRows").innerHTML = rows
    .map((store) => {
      const achievement = store.bep_ach || 0;
      const statusClass = achievement < 0.7 ? "status-critical" : "status-watch";
      const statusText = achievement < 0.7 ? "Critical" : "Watchlist";
      const action =
        achievement < 0.5
          ? "Deep dive cost + traffic"
          : "Push conversion + bundle";
      return `
        <tr>
          <td><strong>${store.store}</strong><span>${store.code}</span></td>
          <td>${store.tsh}</td>
          <td>${formatRp(store.mar26)}</td>
          <td>${formatRp(store.bep)}</td>
          <td class="${achievement < 0.7 ? "negative" : ""}">${pct.format(achievement)}</td>
          <td><span class="status-pill ${statusClass}">${statusText}</span></td>
          <td>${action}</td>
        </tr>
      `;
    })
    .join("");
}

function populateTshFilter(stores) {
  const tshNames = [...new Set(stores.filter((s) => s.status === "Aktif").map((s) => s.tsh))]
    .filter(Boolean)
    .sort();
  qs("tshFilter").innerHTML =
    '<option value="all" selected>All TSH</option>' +
    tshNames
    .map((name) => `<option value="${name}">${name}</option>`)
    .join("");
}

function renderDashboard(data) {
  const activeStores = data.store_list.filter((store) => store.status === "Aktif");
  const q1Growth = data.q1_2026_total / data.q1_2025_total - 1;
  const storesWithBep = activeStores.filter((store) => store.bep > 0);
  const marSales = storesWithBep.reduce((sum, store) => sum + store.mar26, 0);
  const bep = storesWithBep.reduce((sum, store) => sum + store.bep, 0);
  const counts = activeStores.reduce((acc, store) => {
    acc[store.health] = (acc[store.health] || 0) + 1;
    return acc;
  }, {});

  qs("totalSales").textContent = formatRp(data.q1_2026_total);
  qs("q1Growth").textContent = `${plainPct(q1Growth)} vs Q1 2025`;
  qs("bepAchievement").textContent = pct.format(marSales / bep);
  qs("bepNote").textContent = `${formatRp(marSales)} / ${formatRp(bep)}`;
  qs("criticalStores").textContent = counts.Critical || 0;
  qs("aboveBepStores").textContent = counts["Above BEP"] || 0;

  const yearLabels = Object.keys(data.year_totals);
  const yearValues = Object.values(data.year_totals);
  drawBarChart(qs("yearChart"), yearLabels, yearValues, "#087b83");
  drawHealth(qs("healthChart"), counts);
  drawDonut(qs("mixChart"), categoryMix, [
    "#c43d3d",
    "#087b83",
    "#2866b1",
    "#16825d",
    "#ba7a13",
    "#6b7280",
  ]);
  renderTshBars(data.tsh_list);
  renderStoreRows(data.store_list);
  populateTshFilter(data.store_list);
}

fetch(summaryUrl)
  .then((response) => response.json())
  .then(renderDashboard)
  .catch(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<div style="padding:12px;background:#ffe7e7;color:#9d2323;font-weight:700">Data summary belum terbaca. Jalankan preview melalui localhost.</div>',
    );
  });

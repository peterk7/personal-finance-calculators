import {
  VEHICLE_TOTAL, APR, ORIGINAL_TERM, ORIGINAL_DOWN, ORIGINAL_FINANCED, ORIGINAL_PAYMENT,
  LUMP_SUM_TOTAL, LOAN_START,
  round2, fmt, monthLabel,
  s1, s2, s3, s4,
  S3_DOWN, S3_FINANCED, S3_PAYMENT,
  S4_DOWN, S4_FINANCED, S4_PAYMENT,
  CHART_COLORS,
} from "./data.js";

const SCENARIOS = [
  {
    key: "standard",
    cls: "standard",
    badge: "Baseline",
    title: "Standard Payments",
    desc: "$20K down, regular monthly payments for the full 60-month term. No extra payments.",
    down: ORIGINAL_DOWN,
    financed: ORIGINAL_FINANCED,
    payment: ORIGINAL_PAYMENT,
    paymentNote: null,
    termDisplay: `${s1.endMonth} months`,
    endMonth: s1.endMonth,
    totalInterest: s1.totalInterest,
    totalCost: s1.totalPaid,
  },
  {
    key: "actual",
    cls: "actual",
    badge: "What You Did",
    title: "Aggressive Payoff",
    desc: "$20K down, regular payments plus three lump sums ($1K, $4K, $10K) to crush the principal early.",
    down: ORIGINAL_DOWN,
    financed: ORIGINAL_FINANCED,
    payment: ORIGINAL_PAYMENT,
    paymentNote: "+ lump sums",
    termDisplay: `60-month term, paid off in <strong>${s2.endMonth}</strong>`,
    endMonth: s2.endMonth,
    totalInterest: s2.totalInterest,
    totalCost: s2.totalPaid,
  },
  {
    key: "higher-dp",
    cls: "higher-dp",
    badge: "Alternative A",
    title: "Higher Down Payment (60 mo)",
    desc: "$35K down (original $20K + $15K that went to lump sums), smaller loan, 60-month term.",
    down: S3_DOWN,
    financed: S3_FINANCED,
    payment: S3_PAYMENT,
    paymentNote: null,
    termDisplay: `${s3.endMonth} months`,
    endMonth: s3.endMonth,
    totalInterest: s3.totalInterest,
    totalCost: s3.totalPaid,
  },
  {
    key: "shorter",
    cls: "shorter",
    badge: "Alternative B",
    title: "Higher Down Payment (37 mo)",
    desc: "$35K down with a 37-month term to match the aggressive payoff timeline.",
    down: S4_DOWN,
    financed: S4_FINANCED,
    payment: S4_PAYMENT,
    paymentNote: null,
    termDisplay: `${s4.endMonth} months`,
    endMonth: s4.endMonth,
    totalInterest: s4.totalInterest,
    totalCost: s4.totalPaid,
  },
];

let selectedBase = "standard";

// ── Render Cards ──

function renderCards() {
  const container = document.getElementById("cards");
  const base = SCENARIOS.find(s => s.key === selectedBase);

  container.innerHTML = SCENARIOS.map(s => {
    const highlightCls = s.cls === "actual" ? "stat__value--green" : s.cls === "higher-dp" ? "stat__value--blue" : s.cls === "shorter" ? "stat__value--purple" : "stat__value--muted";
    const isBase = s.key === selectedBase;

    const interestDiff = round2(base.totalInterest - s.totalInterest);
    const monthsDiff = base.endMonth - s.endMonth;

    let savingsHtml = "";
    if (isBase) {
      savingsHtml = `<div class="card__savings card__savings--base">Comparison baseline</div>`;
    } else if (interestDiff !== 0 || monthsDiff !== 0) {
      const interestDir = interestDiff > 0 ? "Saves" : "Costs";
      const parts = [];
      if (interestDiff !== 0) parts.push(`${interestDir} ${fmt(Math.abs(interestDiff))} in interest`);
      if (monthsDiff > 0) parts.push(`${monthsDiff} months earlier`);
      else if (monthsDiff < 0) parts.push(`${Math.abs(monthsDiff)} months longer`);
      savingsHtml = `<div class="card__savings">${parts.join(" · ")}</div>`;
    }

    return `
      <div class="card card--${s.cls}">
        <span class="card__badge">${s.badge}</span>
        <h3 class="card__title">${s.title}</h3>
        <p class="card__desc">${s.desc}</p>
        <div class="card__stats">
          <div class="stat">
            <span class="stat__label">Down Payment</span>
            <span class="stat__value">${fmt(s.down)}</span>
          </div>
          <div class="stat">
            <span class="stat__label">Amount Financed</span>
            <span class="stat__value">${fmt(s.financed)}</span>
          </div>
          <div class="stat">
            <span class="stat__label">Monthly Payment</span>
            <span class="stat__value">${fmt(s.payment)}${s.paymentNote ? ` <small style="font-weight:400;color:var(--text-muted)">${s.paymentNote}</small>` : ""}</span>
          </div>
          <div class="stat">
            <span class="stat__label">Term</span>
            <span class="stat__value ${highlightCls}">${s.termDisplay}</span>
          </div>
          <div class="stat">
            <span class="stat__label">Total Interest</span>
            <span class="stat__value ${highlightCls} stat__value--highlight">${fmt(s.totalInterest)}</span>
          </div>
          <div class="stat">
            <span class="stat__label">Total Out-of-Pocket</span>
            <span class="stat__value">${fmt(s.totalCost)}</span>
          </div>
        </div>
        ${savingsHtml}
      </div>
    `;
  }).join("");
}

// ── Compare selector ──

function setupCompareSelector() {
  const buttons = document.querySelectorAll(".compare-btn");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("compare-btn--active"));
      btn.classList.add("compare-btn--active");
      selectedBase = btn.dataset.base;
      renderCards();
      renderTakeaways();
    });
  });
}

// ── Chart helpers ──

function toMap(schedule, keyFn, valFn) {
  const map = {};
  schedule.forEach(e => { map[keyFn(e)] = valFn(e); });
  return map;
}

function fillSeries(map, months, startVal) {
  let last = startVal;
  return months.map(m => {
    if (m in map) { last = map[m]; return last; }
    if (last <= 0) return 0;
    return null;
  });
}

function fillCumSeries(map, months, finalVal) {
  let last = 0;
  return months.map(m => {
    if (m in map) { last = map[m]; return last; }
    if (last >= finalVal) return finalVal;
    return null;
  });
}

// ── Balance Over Time ──

function renderBalanceChart() {
  const months = Array.from({ length: ORIGINAL_TERM + 1 }, (_, i) => i);

  const s1Map = toMap(s1.schedule, e => e.month, e => e.balance);
  const s3Map = toMap(s3.schedule, e => e.month, e => e.balance);
  const s4Map = toMap(s4.schedule, e => e.month, e => e.balance);
  const s2Map = {};
  s2.data.forEach(e => { s2Map[e.month] = e.balance; });

  const ctx = document.getElementById("balanceChart").getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: months.map(monthLabel),
      datasets: [
        {
          label: "Standard Payments",
          data: fillSeries(s1Map, months, ORIGINAL_FINANCED),
          borderColor: CHART_COLORS.standard.line,
          backgroundColor: CHART_COLORS.standard.fill,
          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
        },
        {
          label: "Aggressive Payoff",
          data: fillSeries(s2Map, months, ORIGINAL_FINANCED),
          borderColor: CHART_COLORS.actual.line,
          backgroundColor: CHART_COLORS.actual.fill,
          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2.5,
        },
        {
          label: "Higher Down (60 mo)",
          data: fillSeries(s3Map, months, S3_FINANCED),
          borderColor: CHART_COLORS.higherDp.line,
          backgroundColor: CHART_COLORS.higherDp.fill,
          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
        },
        {
          label: "Higher Down (37 mo)",
          data: fillSeries(s4Map, months, S4_FINANCED),
          borderColor: CHART_COLORS.shorter.line,
          backgroundColor: CHART_COLORS.shorter.fill,
          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, spanGaps: true,
      interaction: { mode: "index", intersect: false },
      plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ": " + (c.parsed.y !== null ? fmt(c.parsed.y) : "Paid off") } } },
      scales: {
        x: { ticks: { maxTicksLimit: 12 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { callback: v => fmt(v) }, grid: { color: "rgba(0,0,0,0.04)" } },
      },
    },
  });
}

// ── Total Cost Breakdown ──

function renderCostChart() {
  const ctx = document.getElementById("costChart").getContext("2d");

  const labels = ["Standard\nPayments", "Aggressive\nPayoff", "Higher Down\n(60 mo)", "Higher Down\n(37 mo)"];
  const downs = [ORIGINAL_DOWN, ORIGINAL_DOWN, S3_DOWN, S4_DOWN];
  const principals = [ORIGINAL_FINANCED, ORIGINAL_FINANCED, S3_FINANCED, S4_FINANCED];
  const interests = [s1.totalInterest, s2.totalInterest, s3.totalInterest, s4.totalInterest];

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Down Payment", data: downs, backgroundColor: ["#cbd5e1", "#a7f3d0", "#bfdbfe", "#ddd6fe"], borderRadius: 4 },
        { label: "Principal (Financed)", data: principals, backgroundColor: ["#94a3b8", "#34d399", "#60a5fa", "#a78bfa"], borderRadius: 4 },
        { label: "Interest Paid", data: interests, backgroundColor: ["#64748b", "#059669", "#2563eb", "#7c3aed"], borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ": " + fmt(c.parsed.y) } } },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, ticks: { callback: v => fmt(v) }, grid: { color: "rgba(0,0,0,0.04)" } },
      },
    },
  });
}

// ── Cumulative Interest ──

function renderInterestChart() {
  const months = Array.from({ length: ORIGINAL_TERM + 1 }, (_, i) => i);

  const s1Map = toMap(s1.schedule, e => e.month, e => e.cumulativeInterest);
  const s3Map = toMap(s3.schedule, e => e.month, e => e.cumulativeInterest);
  const s4Map = toMap(s4.schedule, e => e.month, e => e.cumulativeInterest);
  const s2Map = {};
  s2.data.forEach(e => { s2Map[e.month] = e.cumulativeInterest; });

  const ctx = document.getElementById("interestChart").getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: months.map(monthLabel),
      datasets: [
        { label: "Standard Payments", data: fillCumSeries(s1Map, months, s1.totalInterest), borderColor: CHART_COLORS.standard.line, tension: 0.3, pointRadius: 0, borderWidth: 2 },
        { label: "Aggressive Payoff", data: fillCumSeries(s2Map, months, s2.totalInterest), borderColor: CHART_COLORS.actual.line, tension: 0.3, pointRadius: 0, borderWidth: 2.5 },
        { label: "Higher Down (60 mo)", data: fillCumSeries(s3Map, months, s3.totalInterest), borderColor: CHART_COLORS.higherDp.line, tension: 0.3, pointRadius: 0, borderWidth: 2 },
        { label: "Higher Down (37 mo)", data: fillCumSeries(s4Map, months, s4.totalInterest), borderColor: CHART_COLORS.shorter.line, tension: 0.3, pointRadius: 0, borderWidth: 2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, spanGaps: true,
      interaction: { mode: "index", intersect: false },
      plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ": " + (c.parsed.y !== null ? fmt(c.parsed.y) : "") } } },
      scales: {
        x: { ticks: { maxTicksLimit: 12 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { callback: v => fmt(v) }, grid: { color: "rgba(0,0,0,0.04)" } },
      },
    },
  });
}

// ── Takeaways ──

function renderTakeaways() {
  const container = document.getElementById("takeaways");
  const interestSavedActual = round2(s1.totalInterest - s2.totalInterest);
  const monthsSaved = s1.endMonth - s2.endMonth;
  const actualVsS3 = round2(s2.totalInterest - s3.totalInterest);
  const actualVsS4 = round2(s2.totalInterest - s4.totalInterest);
  const s4Direction = actualVsS4 > 0 ? "more" : "less";

  container.innerHTML = `
    <h2>Key Takeaways</h2>
    <ul>
      <li>By making aggressive lump-sum payments, you saved <strong>${fmt(interestSavedActual)}</strong> in interest and paid off the loan <strong>${monthsSaved} months early</strong>.</li>
      <li>The higher down payment over 60 months actually costs <strong>${fmt(Math.abs(actualVsS3))} ${actualVsS3 < 0 ? "more" : "less"}</strong> in interest than your approach &mdash; the lower payments stretched over 5 years let interest accumulate longer.</li>
      <li>The best interest outcome is the higher down payment with a 37-month term: only <strong>${fmt(s4.totalInterest)}</strong> in total interest. Your aggressive approach paid <strong>${fmt(Math.abs(actualVsS4))} ${s4Direction}</strong> &mdash; ${actualVsS4 > 0
      ? "because you started with a larger loan and paid interest on the higher balance in the early months."
      : "because the lump sums hit the principal at optimal times."
    }</li>
      <li>However, the higher down payment scenarios required <strong>${fmt(LUMP_SUM_TOTAL)}</strong> up front that you got to keep in your pocket and deploy strategically over time.</li>
      <li>All four strategies pay the same <strong>${fmt(VEHICLE_TOTAL)}</strong> in principal &mdash; the only variable is how much interest goes to the lender.</li>
    </ul>
  `;
}

// ── Init ──

setupCompareSelector();
renderCards();
renderBalanceChart();
renderCostChart();
renderInterestChart();
renderTakeaways();

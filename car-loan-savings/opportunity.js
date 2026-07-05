import {
  APR, ORIGINAL_TERM, ORIGINAL_DOWN, ORIGINAL_PAYMENT, LUMP_SUM_TOTAL, LOAN_START,
  round2, fmt, monthLabel, compoundGrowth, calcPayment,
  s1, s2,
  LUMP_SUMS, INTEREST_SAVED, CHART_COLORS,
} from "./data.js";

const RATES = [5, 6, 8, 10, 12];
const RATE_HINTS = { 5: "Below average", 6: "Below average", 8: "Average market return", 10: "Above average", 12: "Above average" };
const PAYOFF_MONTH = s2.endMonth; // 37
const FREED_MONTHS = ORIGINAL_TERM - PAYOFF_MONTH; // 23
const FREED_PRINCIPAL = round2(FREED_MONTHS * ORIGINAL_PAYMENT);
let selectedRate = 8;
let portfolioChart = null;
let sensitivityChart = null;

// ── Calculations ──

function calcStrategyA(rate) {
  const r = rate / 100 / 12;
  let portfolio = 0;
  const timeline = [{ month: 0, value: 0 }];

  for (let m = 1; m <= ORIGINAL_TERM; m++) {
    portfolio *= (1 + r);
    if (m > PAYOFF_MONTH) portfolio += ORIGINAL_PAYMENT;
    timeline.push({ month: m, value: round2(portfolio) });
  }

  const growth = round2(portfolio - FREED_PRINCIPAL);

  return {
    principal: FREED_PRINCIPAL,
    growth,
    portfolio: round2(portfolio),
    interestSaved: INTEREST_SAVED,
    totalBenefit: round2(portfolio + INTEREST_SAVED),
    timeline,
  };
}

function calcStrategyB(rate) {
  const r = rate / 100 / 12;
  let portfolio = 0;
  const timeline = [{ month: 0, value: 0 }];

  for (let m = 1; m <= ORIGINAL_TERM; m++) {
    portfolio *= (1 + r);
    const deposit = LUMP_SUMS.find(ls => ls.month === m);
    if (deposit) portfolio += deposit.amount;
    timeline.push({ month: m, value: round2(portfolio) });
  }

  const growth = round2(portfolio - LUMP_SUM_TOTAL);

  return {
    principal: LUMP_SUM_TOTAL,
    growth,
    portfolio: round2(portfolio),
    totalBenefit: round2(portfolio),
    timeline,
  };
}

function calcDownPaymentOC(rate) {
  const futureValue = round2(compoundGrowth(ORIGINAL_DOWN, rate, ORIGINAL_TERM));
  const marketGain = round2(futureValue - ORIGINAL_DOWN);
  const extraPayment = round2(calcPayment(ORIGINAL_DOWN, APR, ORIGINAL_TERM));
  const extraInterest = round2(extraPayment * ORIGINAL_TERM - ORIGINAL_DOWN);
  const netForegone = round2(marketGain - extraInterest);
  return { futureValue, marketGain, extraInterest, netForegone };
}

function findBreakeven() {
  let lo = 0, hi = 50;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const a = calcStrategyA(mid);
    const b = calcStrategyB(mid);
    if (a.totalBenefit > b.totalBenefit) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2 * 100) / 100;
}

const BREAKEVEN_RATE = findBreakeven();

// ── Rendering ──

function render() {
  const dpOC = calcDownPaymentOC(selectedRate);
  const stratA = calcStrategyA(selectedRate);
  const stratB = calcStrategyB(selectedRate);

  renderDownPaymentContext(dpOC);
  renderStrategyCards(stratA, stratB);
  renderPortfolioChart(stratA, stratB);
  renderSensitivityChart();
  renderVerdict(stratA, stratB);
}

function renderDownPaymentContext(dpOC) {
  const el = document.getElementById("downPaymentContext");
  el.innerHTML = `
    <strong>Down payment opportunity cost:</strong>
    If your <strong>${fmt(ORIGINAL_DOWN)}</strong> down payment had been invested for ${ORIGINAL_TERM} months at ${selectedRate}%,
    it would be worth <strong>${fmt(dpOC.futureValue)}</strong> (market gain: ${fmt(dpOC.marketGain)}).
    However, skipping the down payment means financing an extra ${fmt(ORIGINAL_DOWN)} at ${APR}%, costing
    <strong>${fmt(dpOC.extraInterest)}</strong> in additional loan interest.
    <br><strong>Net foregone gain: ${fmt(dpOC.netForegone)}</strong>
    <br><span class="muted">Common to both strategies. At low return rates, the down payment saves more in interest than the market would earn.</span>
  `;
}

function renderStrategyCards(stratA, stratB) {
  const container = document.getElementById("strategyCards");
  const aWins = stratA.totalBenefit > stratB.totalBenefit;
  const diff = round2(Math.abs(stratA.totalBenefit - stratB.totalBenefit));

  container.innerHTML = `
    <div class="card card--strategy-a">
      <span class="card__badge">What You Did</span>
      <h3 class="card__title">Pay Down the Loan</h3>
      <p class="card__desc">$15K in lump sums paid off the loan at month ${PAYOFF_MONTH}. Freed-up $${ORIGINAL_PAYMENT}/mo invested for the remaining ${FREED_MONTHS} months.</p>
      <div class="card__stats">
        <div class="stat">
          <span class="stat__label">Principal Invested (freed payments)</span>
          <span class="stat__value">${fmt(stratA.principal)}</span>
        </div>
        <div class="stat">
          <span class="stat__label">Investment Growth (${selectedRate}%)</span>
          <span class="stat__value">${fmt(stratA.growth)}</span>
        </div>
        <div class="stat">
          <span class="stat__label">Portfolio at Month 60</span>
          <span class="stat__value stat__value--highlight">${fmt(stratA.portfolio)}</span>
        </div>
        <div class="stat" style="border-top:2px solid var(--actual);padding-top:12px">
          <span class="stat__label">Interest Saved on Car (guaranteed)</span>
          <span class="stat__value stat__value--green">${fmt(stratA.interestSaved)}</span>
        </div>
        <div class="stat">
          <span class="stat__label">Total Benefit</span>
          <span class="stat__value stat__value--green stat__value--highlight">${fmt(stratA.totalBenefit)}</span>
        </div>
      </div>
      ${aWins ? `<div class="card__savings">Wins by ${fmt(diff)}</div>` : ""}
    </div>

    <div class="card card--strategy-b">
      <span class="card__badge">Alternative</span>
      <h3 class="card__title">Invest in the Market</h3>
      <p class="card__desc">Same $1K, $4K, $10K invested in the market at the same dates. Loan runs the full 60 months.</p>
      <div class="card__stats">
        <div class="stat">
          <span class="stat__label">Principal Invested (lump sums)</span>
          <span class="stat__value">${fmt(stratB.principal)}</span>
        </div>
        <div class="stat">
          <span class="stat__label">Investment Growth (${selectedRate}%)</span>
          <span class="stat__value">${fmt(stratB.growth)}</span>
        </div>
        <div class="stat">
          <span class="stat__label">Portfolio at Month 60</span>
          <span class="stat__value stat__value--highlight">${fmt(stratB.portfolio)}</span>
        </div>
        <div class="stat" style="border-top:2px solid var(--border);padding-top:12px">
          <span class="stat__label">Interest Saved on Car</span>
          <span class="stat__value stat__value--muted">${fmt(0)}</span>
        </div>
        <div class="stat">
          <span class="stat__label">Total Benefit</span>
          <span class="stat__value stat__value--highlight">${fmt(stratB.totalBenefit)}</span>
        </div>
      </div>
      ${!aWins ? `<div class="card__savings">Wins by ${fmt(diff)}</div>` : ""}
    </div>
  `;
}

function renderPortfolioChart(stratA, stratB) {
  const months = Array.from({ length: ORIGINAL_TERM + 1 }, (_, i) => i);
  const labels = months.map(monthLabel);

  const datasets = [
    {
      label: "A: Pay Down Loan + Freed Payments",
      data: stratA.timeline.map(p => p.value),
      borderColor: CHART_COLORS.actual.line,
      backgroundColor: CHART_COLORS.actual.fill,
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2.5,
    },
    {
      label: "B: Invest in Market",
      data: stratB.timeline.map(p => p.value),
      borderColor: "#f59e0b",
      backgroundColor: "rgba(245,158,11,0.06)",
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2,
    },
  ];

  if (portfolioChart) {
    portfolioChart.data.datasets.forEach((ds, i) => { ds.data = datasets[i].data; ds.label = datasets[i].label; });
    portfolioChart.update();
    return;
  }

  const ctx = document.getElementById("portfolioChart").getContext("2d");
  portfolioChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        tooltip: { callbacks: { label: c => c.dataset.label + ": " + fmt(c.parsed.y) } },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 12 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { callback: v => fmt(v) }, grid: { color: "rgba(0,0,0,0.04)" } },
      },
    },
  });
}

function renderSensitivityChart() {
  const rateLabels = RATES.map(r => r + "%");

  const stratABenefits = RATES.map(r => calcStrategyA(r).totalBenefit);
  const stratBBenefits = RATES.map(r => calcStrategyB(r).totalBenefit);

  const datasets = [
    {
      label: "A: Loan Payoff (portfolio + interest saved)",
      data: stratABenefits,
      borderColor: CHART_COLORS.actual.line,
      backgroundColor: CHART_COLORS.actual.line,
      borderWidth: 2.5,
      pointRadius: 5,
      tension: 0.3,
    },
    {
      label: "B: Market (portfolio only)",
      data: stratBBenefits,
      borderColor: "#f59e0b",
      backgroundColor: "#f59e0b",
      borderWidth: 2,
      pointRadius: 5,
      tension: 0.3,
    },
  ];

  if (sensitivityChart) {
    sensitivityChart.data.datasets.forEach((ds, i) => { ds.data = datasets[i].data; });
    sensitivityChart.update();
    return;
  }

  // Position break-even as fractional index on the categorical X axis
  const beIdx = (() => {
    for (let i = 0; i < RATES.length - 1; i++) {
      if (BREAKEVEN_RATE >= RATES[i] && BREAKEVEN_RATE <= RATES[i + 1]) {
        return i + (BREAKEVEN_RATE - RATES[i]) / (RATES[i + 1] - RATES[i]);
      }
    }
    return 0;
  })();

  const ctx = document.getElementById("sensitivityChart").getContext("2d");
  sensitivityChart = new Chart(ctx, {
    type: "line",
    data: { labels: rateLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        tooltip: { callbacks: { label: c => c.dataset.label + ": " + fmt(c.parsed.y) } },
        annotation: {
          annotations: {
            breakevenLine: {
              type: "line",
              xMin: beIdx,
              xMax: beIdx,
              borderColor: "rgba(107,114,128,0.5)",
              borderWidth: 1.5,
              borderDash: [6, 4],
              label: {
                display: true,
                content: `Break-even: ${BREAKEVEN_RATE}%`,
                position: "start",
                backgroundColor: "rgba(107,114,128,0.85)",
                color: "#fff",
                font: { size: 11, weight: "bold" },
                padding: 4,
              },
            },
          },
        },
      },
      scales: {
        x: { title: { display: true, text: "Annual Return Rate" }, grid: { display: false } },
        y: { title: { display: true, text: "Total Benefit at Month 60" }, ticks: { callback: v => fmt(v) }, grid: { color: "rgba(0,0,0,0.04)" } },
      },
    },
  });
}

function renderVerdict(stratA, stratB) {
  const el = document.getElementById("verdict");
  const diff = round2(stratA.totalBenefit - stratB.totalBenefit);
  const aWins = diff > 0;

  el.innerHTML = `
    <h2>The Verdict at ${selectedRate}% Returns</h2>
    <p class="big-number ${aWins ? "big-number--green" : "big-number--red"}">
      ${aWins ? "Paying down the loan wins" : "Investing wins"} by ${fmt(Math.abs(diff))}
    </p>
    <p>
      ${aWins
        ? `At ${selectedRate}% returns, your strategy was the right call. Your portfolio of <strong>${fmt(stratA.portfolio)}</strong> plus guaranteed interest savings of <strong>${fmt(stratA.interestSaved)}</strong> outpaces the market alternative.`
        : `At ${selectedRate}% returns, investing the $15K would have come out ahead. The market portfolio of <strong>${fmt(stratB.portfolio)}</strong> beats your combined portfolio of <strong>${fmt(stratA.portfolio)}</strong> plus <strong>${fmt(stratA.interestSaved)}</strong> in interest savings.`
      }
    </p>
    <p style="margin-top:16px;font-size:0.95rem;">
      <strong>Break-even rate: ${BREAKEVEN_RATE}%</strong> &mdash;
      below this, paying down the loan wins. Above it, investing wins.
    </p>
    <p style="margin-top:12px;color:var(--text-muted);font-size:0.85rem;">
      Strategy A's total benefit = investment portfolio + guaranteed interest savings (two separate wins).<br>
      Strategy B's total benefit = investment portfolio only (market-dependent).
    </p>
  `;
}

// ── Rate selector ──

function setupRateSelector() {
  const buttons = document.querySelectorAll(".rate-btn");
  const hint = document.getElementById("rateHint");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("rate-btn--active"));
      btn.classList.add("rate-btn--active");
      selectedRate = Number(btn.dataset.rate);
      hint.textContent = RATE_HINTS[selectedRate];
      render();
    });
  });
}

// ── Init ──

setupRateSelector();
render();

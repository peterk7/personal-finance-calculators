const LIFETIME_LIMIT = 50000;
const CESG_RATE = 0.20;
const CESG_ANNUAL_MAX = 1000;
const CESG_LIFETIME = 7200;
const CESG_ROOM_PER_YEAR = 500;
const END_AGE = 18;

function simulate(startAge, contributions, returnRate) {
  let totalContributions = 0;
  let totalCESG = 0;
  let balance = 0;
  let cesgRoom = startAge * CESG_ROOM_PER_YEAR;
  const years = [];

  for (let i = 0; i < contributions.length; i++) {
    const age = startAge + i;
    cesgRoom += CESG_ROOM_PER_YEAR;

    let contribution = Math.min(contributions[i], LIFETIME_LIMIT - totalContributions);
    contribution = Math.max(0, contribution);

    let potentialCESG = Math.min(
      contribution * CESG_RATE,
      cesgRoom,
      CESG_ANNUAL_MAX,
      CESG_LIFETIME - totalCESG
    );
    const cesg = Math.max(0, potentialCESG);
    cesgRoom -= cesg;

    const growthOnExisting = balance * returnRate;
    const growthOnNew = (contribution + cesg) * returnRate;
    balance = balance + growthOnExisting + contribution + cesg + growthOnNew;

    totalContributions += contribution;
    totalCESG += cesg;

    years.push({
      age,
      contribution,
      cesg,
      cesgRoom,
      growthThisYear: growthOnExisting + growthOnNew,
      totalContributions,
      totalCESG,
      balance,
      investmentGrowth: balance - totalContributions - totalCESG,
    });
  }

  return {
    years,
    totalContributions,
    totalCESG,
    balance,
    investmentGrowth: balance - totalContributions - totalCESG,
  };
}

function flatSchedule(startAge, annualContrib) {
  return Array(END_AGE - startAge).fill(annualContrib);
}

function computeOptimalSchedule(startAge, totalBudget) {
  const numYears = END_AGE - startAge;
  if (numYears <= 0) return [];

  let cesgRoom = startAge * CESG_ROOM_PER_YEAR;
  let totalCESG = 0;
  const minForCESG = [];

  for (let i = 0; i < numYears; i++) {
    cesgRoom += CESG_ROOM_PER_YEAR;

    let maxCESG = Math.min(cesgRoom, CESG_ANNUAL_MAX, CESG_LIFETIME - totalCESG);
    maxCESG = Math.max(0, maxCESG);

    const contribNeeded = maxCESG / CESG_RATE;
    cesgRoom -= maxCESG;
    totalCESG += maxCESG;
    minForCESG.push(contribNeeded);
  }

  const totalMinForCESG = minForCESG.reduce((a, b) => a + b, 0);
  const budget = Math.min(totalBudget, LIFETIME_LIMIT);
  let extra = Math.max(0, budget - totalMinForCESG);

  const schedule = [...minForCESG];
  schedule[0] += extra;

  let runningTotal = 0;
  for (let i = 0; i < schedule.length; i++) {
    schedule[i] = Math.min(schedule[i], LIFETIME_LIMIT - runningTotal);
    schedule[i] = Math.max(0, schedule[i]);
    runningTotal += schedule[i];
  }

  return schedule;
}

function describeOptimalSchedule(schedule) {
  if (!schedule.length) return '';
  const yr1 = schedule[0];
  const rest = schedule.slice(1);
  const nonZero = rest.filter((v) => v > 0);
  if (!nonZero.length) return `${fmt(yr1)} in year 1`;

  const allSame = nonZero.every((v) => Math.abs(v - nonZero[0]) < 1);
  if (allSame && nonZero.length === rest.length) {
    if (Math.abs(yr1 - nonZero[0]) < 1) return `${fmt(yr1)}/yr`;
    return `${fmt(yr1)} yr 1, then ${fmt(nonZero[0])}/yr`;
  }

  const groups = [];
  let current = schedule[0];
  let count = 1;
  for (let i = 1; i < schedule.length; i++) {
    if (Math.abs(schedule[i] - current) < 1) {
      count++;
    } else {
      groups.push({ amount: current, count });
      current = schedule[i];
      count = 1;
    }
  }
  groups.push({ amount: current, count });

  return groups
    .filter((g) => g.amount > 0)
    .map((g) => (g.count === 1 ? fmt(g.amount) : `${fmt(g.amount)}/yr x${g.count}`))
    .join(', then ');
}

function fmt(n) {
  return '$' + Math.round(n).toLocaleString('en-CA');
}

// --- UI ---

let growthChart = null;
let compositionChart = null;
let activeTab = 'user';
let lastUserResult = null;
let lastOptimalResult = null;

const $ = (id) => document.getElementById(id);

function init() {
  const ageSelect = $('childAge');
  for (let age = 0; age < END_AGE; age++) {
    const opt = document.createElement('option');
    opt.value = age;
    opt.textContent = age === 0 ? 'Newborn (0)' : `${age} year${age > 1 ? 's' : ''} old`;
    ageSelect.appendChild(opt);
  }

  const contribSlider = $('annualContributionSlider');
  const contribInput = $('annualContribution');
  contribSlider.addEventListener('input', () => {
    contribInput.value = contribSlider.value;
    update();
  });
  contribInput.addEventListener('input', () => {
    contribSlider.value = Math.min(contribInput.value, 16000);
    update();
  });

  const rateSlider = $('returnRateSlider');
  rateSlider.addEventListener('input', () => {
    $('returnRateDisplay').textContent = parseFloat(rateSlider.value).toFixed(1) + '%';
    update();
  });

  ageSelect.addEventListener('change', update);

  document.querySelectorAll('.table-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.table-tab').forEach((b) => b.classList.remove('table-tab--active'));
      btn.classList.add('table-tab--active');
      activeTab = btn.dataset.tab;
      renderTable(activeTab === 'user' ? lastUserResult : lastOptimalResult);
    });
  });

  update();
}

function update() {
  const startAge = parseInt($('childAge').value);
  const annualContrib = parseFloat($('annualContribution').value) || 0;
  const returnRate = parseFloat($('returnRateSlider').value) / 100;
  const numYears = END_AGE - startAge;

  if (numYears <= 0) {
    clearResults();
    return;
  }

  const userSchedule = flatSchedule(startAge, annualContrib);
  const userResult = simulate(startAge, userSchedule, returnRate);

  const userTotal = userResult.totalContributions;
  const optimalSchedule = computeOptimalSchedule(startAge, Math.max(userTotal, LIFETIME_LIMIT));
  const optimalResult = simulate(startAge, optimalSchedule, returnRate);

  lastUserResult = userResult;
  lastOptimalResult = optimalResult;

  $('userPlanLabel').textContent = `${fmt(annualContrib)}/yr`;
  $('userContributions').textContent = fmt(userResult.totalContributions);
  $('userCESG').textContent = fmt(userResult.totalCESG);
  $('userGrowth').textContent = fmt(userResult.investmentGrowth);
  $('userTotal').textContent = fmt(userResult.balance);

  let cesgNote = '';
  if (userResult.totalCESG < CESG_LIFETIME) {
    const missed = CESG_LIFETIME - userResult.totalCESG;
    cesgNote = `You're leaving <strong>${fmt(missed)}</strong> of free CESG on the table. `;
    if (annualContrib < 5000 && startAge > 0) {
      cesgNote += `Contributing $5,000/yr would help catch up on unused grant room.`;
    } else if (annualContrib < 2500) {
      cesgNote += `Contributing at least $2,500/yr would earn the full $500/yr CESG.`;
    }
  } else {
    cesgNote = `CESG fully maximized at ${fmt(CESG_LIFETIME)}.`;
  }
  $('userCESGNote').innerHTML = cesgNote;

  $('optimalPlanLabel').textContent = describeOptimalSchedule(optimalSchedule);
  $('optimalContributions').textContent = fmt(optimalResult.totalContributions);
  $('optimalCESG').textContent = fmt(optimalResult.totalCESG);
  $('optimalGrowth').textContent = fmt(optimalResult.investmentGrowth);
  $('optimalTotal').textContent = fmt(optimalResult.balance);

  const delta = optimalResult.balance - userResult.balance;
  const deltaEl = $('optimalDelta');
  if (delta > 100) {
    deltaEl.className = 'strategy-card__delta strategy-card__delta--positive';
    deltaEl.textContent = `+${fmt(delta)} more than your plan`;
  } else {
    deltaEl.className = 'strategy-card__delta strategy-card__delta--neutral';
    deltaEl.textContent = 'Same as your plan — you\'re on the optimal path!';
  }

  renderRecommendation(startAge, annualContrib, userResult, optimalResult, optimalSchedule);
  renderChart(userResult, optimalResult, startAge);
  renderCompositionChart(userResult, optimalResult);
  renderTable(activeTab === 'user' ? userResult : optimalResult);
}

function clearResults() {
  ['userContributions', 'userCESG', 'userGrowth', 'userTotal',
   'optimalContributions', 'optimalCESG', 'optimalGrowth', 'optimalTotal']
    .forEach((id) => { $(id).textContent = '$0'; });
  $('userCESGNote').innerHTML = '';
  $('optimalDelta').textContent = '';
  $('recommendation').innerHTML = '';
  $('breakdownBody').innerHTML = '';
  $('breakdownFoot').innerHTML = '';
}

function renderRecommendation(startAge, annualContrib, userResult, optimalResult, optimalSchedule) {
  const el = $('recommendation');
  const lines = [];
  const yearsAvailable = END_AGE - startAge;
  const delta = optimalResult.balance - userResult.balance;

  if (startAge > 0 && annualContrib < 5000) {
    const missedRoom = startAge * CESG_ROOM_PER_YEAR;
    lines.push(
      `<strong>Catch-up opportunity:</strong> Your child has <span class="highlight">${fmt(missedRoom)}</span> of accumulated CESG room from ${startAge} missed year${startAge > 1 ? 's' : ''}. Contributing $5,000/yr lets you claim up to $1,000/yr in CESG to catch up.`
    );
  }

  if (annualContrib < 2500) {
    lines.push(
      `<strong>Tip:</strong> Contributing at least <span class="highlight">$2,500/yr</span> earns the full $500/yr CESG — that's an instant 20% return on your money.`
    );
  }

  if (delta > 500) {
    lines.push(
      `<strong>Front-loading advantage:</strong> The optimal plan puts more in early years for extra compounding. At ${(parseFloat($('returnRateSlider').value)).toFixed(1)}% return, this adds <span class="highlight">${fmt(delta)}</span> by age 18.`
    );
  }

  if (annualContrib * yearsAvailable > LIFETIME_LIMIT) {
    const effectiveYears = Math.ceil(LIFETIME_LIMIT / annualContrib);
    lines.push(
      `<strong>Note:</strong> At ${fmt(annualContrib)}/yr, you'll hit the $50,000 lifetime limit in ${effectiveYears} year${effectiveYears > 1 ? 's' : ''}. Contributions stop after that but the balance keeps growing.`
    );
  }

  el.innerHTML = lines.join('<br><br>');
}

function renderChart(userResult, optimalResult, startAge) {
  const ctx = $('growthChart').getContext('2d');

  const userLabels = userResult.years.map((y) => `Age ${y.age}`);
  const optLabels = optimalResult.years.map((y) => `Age ${y.age}`);
  const labels = ['Start', ...userLabels];

  const userBalances = [0, ...userResult.years.map((y) => y.balance)];
  const optBalances = [0, ...optimalResult.years.map((y) => y.balance)];

  const showOptimal = Math.abs(optimalResult.balance - userResult.balance) > 100;

  const datasets = [
    {
      label: 'Your Plan',
      data: userBalances,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.08)',
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2.5,
    },
  ];

  if (showOptimal) {
    datasets.push({
      label: 'Optimal Plan',
      data: optBalances,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2.5,
      borderDash: [6, 3],
    });
  }

  if (growthChart) growthChart.destroy();

  growthChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: showOptimal, position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v) => '$' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v),
          },
          grid: { color: 'rgba(0,0,0,0.04)' },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });
}

function renderCompositionChart(userResult, optimalResult) {
  const ctx = $('compositionChart').getContext('2d');

  const labels = ['Your Plan', 'Optimal Plan'];
  const datasets = [
    {
      label: 'Contributions',
      data: [userResult.totalContributions, optimalResult.totalContributions],
      backgroundColor: '#93c5fd',
      borderRadius: 4,
    },
    {
      label: 'CESG Grants',
      data: [userResult.totalCESG, optimalResult.totalCESG],
      backgroundColor: '#6ee7b7',
      borderRadius: 4,
    },
    {
      label: 'Investment Growth',
      data: [userResult.investmentGrowth, optimalResult.investmentGrowth],
      backgroundColor: '#c4b5fd',
      borderRadius: 4,
    },
  ];

  if (compositionChart) compositionChart.destroy();

  compositionChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            callback: (v) => '$' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v),
          },
          grid: { color: 'rgba(0,0,0,0.04)' },
        },
      },
    },
  });
}

function renderTable(result) {
  const tbody = $('breakdownBody');
  const tfoot = $('breakdownFoot');

  if (!result || !result.years.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No data</td></tr>';
    tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = result.years
    .map(
      (y) => `
    <tr>
      <td>${y.age}</td>
      <td>${fmt(y.contribution)}</td>
      <td class="cesg-cell">${fmt(y.cesg)}</td>
      <td class="hide-mobile">${fmt(y.cesgRoom)}</td>
      <td class="growth-cell">${fmt(y.growthThisYear)}</td>
      <td class="balance-cell">${fmt(y.balance)}</td>
    </tr>
  `
    )
    .join('');

  const last = result.years[result.years.length - 1];
  tfoot.innerHTML = `
    <tr>
      <td>Total</td>
      <td>${fmt(result.totalContributions)}</td>
      <td class="cesg-cell">${fmt(result.totalCESG)}</td>
      <td class="hide-mobile">—</td>
      <td class="growth-cell">${fmt(result.investmentGrowth)}</td>
      <td class="balance-cell">${fmt(result.balance)}</td>
    </tr>
  `;
}

document.addEventListener('DOMContentLoaded', init);

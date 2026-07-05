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

function computeOptimalSchedule(startAge, lumpNow, annualCapacity) {
  const numYears = END_AGE - startAge;
  if (numYears <= 0) return [];

  let cesgRoom = startAge * CESG_ROOM_PER_YEAR;
  let totalCESG = 0;
  const minForCESG = [];

  for (let i = 0; i < numYears; i++) {
    cesgRoom += CESG_ROOM_PER_YEAR;

    let maxCESG = Math.min(cesgRoom, CESG_ANNUAL_MAX, CESG_LIFETIME - totalCESG);
    maxCESG = Math.max(0, maxCESG);

    cesgRoom -= maxCESG;
    totalCESG += maxCESG;
    minForCESG.push(maxCESG / CESG_RATE);
  }

  // lifetime room that must stay unused after each year so every future
  // CESG-earning contribution still fits under the $50k cap
  const futureNeed = Array(numYears).fill(0);
  for (let i = numYears - 2; i >= 0; i--) {
    futureNeed[i] = futureNeed[i + 1] + minForCESG[i + 1];
  }

  // front-load whatever cash is on hand, but never eat the room
  // reserved for future CESG years
  const schedule = [];
  let cash = lumpNow;
  let contributed = 0;
  for (let i = 0; i < numYears; i++) {
    cash += annualCapacity;
    const roomLeft = LIFETIME_LIMIT - contributed;
    const cap = Math.max(0, roomLeft - futureNeed[i]);
    const contribution = Math.max(0, Math.min(cash, cap));
    schedule.push(contribution);
    cash -= contribution;
    contributed += contribution;
  }

  return schedule;
}

function lumpAndForgetSchedule(startAge) {
  const numYears = END_AGE - startAge;
  if (numYears <= 0) return [];
  const schedule = Array(numYears).fill(0);
  schedule[0] = LIFETIME_LIMIT;
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
let lastLumpResult = null;

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

  const lumpSlider = $('lumpSumSlider');
  const lumpInput = $('lumpSum');
  lumpSlider.addEventListener('input', () => {
    lumpInput.value = lumpSlider.value;
    update();
  });
  lumpInput.addEventListener('input', () => {
    lumpSlider.value = Math.min(lumpInput.value, 50000);
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
      renderTable(resultForTab(activeTab));
    });
  });

  update();
}

function resultForTab(tab) {
  if (tab === 'optimal') return lastOptimalResult;
  if (tab === 'lump') return lastLumpResult;
  return lastUserResult;
}

function update() {
  const startAge = parseInt($('childAge').value);
  const annualContrib = parseFloat($('annualContribution').value) || 0;
  const lumpSum = parseFloat($('lumpSum').value) || 0;
  const returnRate = parseFloat($('returnRateSlider').value) / 100;
  const numYears = END_AGE - startAge;

  if (numYears <= 0) {
    clearResults();
    return;
  }

  const userSchedule = flatSchedule(startAge, annualContrib);
  userSchedule[0] += lumpSum;
  const userResult = simulate(startAge, userSchedule, returnRate);

  // same cash as your plan (lump today + annual capacity), best timing
  const optimalSchedule = computeOptimalSchedule(startAge, lumpSum, annualContrib);
  const optimalResult = simulate(startAge, optimalSchedule, returnRate);

  const lumpResult = simulate(startAge, lumpAndForgetSchedule(startAge), returnRate);

  lastUserResult = userResult;
  lastOptimalResult = optimalResult;
  lastLumpResult = lumpResult;

  $('userPlanLabel').textContent = lumpSum > 0
    ? `${fmt(lumpSum)} now + ${fmt(annualContrib)}/yr`
    : `${fmt(annualContrib)}/yr`;
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
    deltaEl.textContent = 'Same as your plan — nothing more to extract.';
  }

  $('lumpContributions').textContent = fmt(lumpResult.totalContributions);
  $('lumpCESG').textContent = fmt(lumpResult.totalCESG);
  $('lumpGrowth').textContent = fmt(lumpResult.investmentGrowth);
  $('lumpTotal').textContent = fmt(lumpResult.balance);
  $('lumpCESGNote').innerHTML =
    `Forgoes <strong>${fmt(CESG_LIFETIME - lumpResult.totalCESG)}</strong> of CESG in exchange for maximum time in the market.`;

  const lumpDelta = lumpResult.balance - userResult.balance;
  const lumpDeltaEl = $('lumpDelta');
  if (lumpDelta > 100) {
    lumpDeltaEl.className = 'strategy-card__delta strategy-card__delta--positive';
    lumpDeltaEl.textContent = `+${fmt(lumpDelta)} more than your plan`;
  } else if (lumpDelta < -100) {
    lumpDeltaEl.className = 'strategy-card__delta strategy-card__delta--neutral';
    lumpDeltaEl.textContent = `${fmt(Math.abs(lumpDelta))} less than your plan`;
  } else {
    lumpDeltaEl.className = 'strategy-card__delta strategy-card__delta--neutral';
    lumpDeltaEl.textContent = 'Effectively tied with your plan';
  }

  renderIdealState(startAge, returnRate, lumpSum);
  renderRecommendation(startAge, annualContrib, userResult, optimalResult, optimalSchedule);
  renderChart(userResult, optimalResult, lumpResult, startAge);
  renderCompositionChart(userResult, optimalResult, lumpResult);
  renderTable(resultForTab(activeTab));
}

function renderIdealState(startAge, returnRate, lumpSum) {
  const el = $('idealState');
  const ratePct = (returnRate * 100).toFixed(1);

  // the two "full $50k on day one" worlds
  const fullOptimalSchedule = computeOptimalSchedule(startAge, LIFETIME_LIMIT, 0);
  const fullOptimal = simulate(startAge, fullOptimalSchedule, returnRate);
  const fullLump = simulate(startAge, lumpAndForgetSchedule(startAge), returnRate);
  const diff = fullOptimal.balance - fullLump.balance;

  // the return rate where all-in-year-one overtakes the CESG-fed plan
  let crossover = null;
  for (let r = 1; r <= 15; r += 0.25) {
    const o = simulate(startAge, fullOptimalSchedule, r / 100);
    const l = simulate(startAge, lumpAndForgetSchedule(startAge), r / 100);
    if (l.balance > o.balance) {
      crossover = r;
      break;
    }
  }

  const lines = [];
  lines.push(
    `<strong>The ideal state:</strong> put down as much as you can afford <em>up front</em>, and keep at least <span class="highlight">$2,500/yr</span> flowing (or $5,000/yr when catching up on missed years) until the full ${fmt(CESG_LIFETIME)} CESG is collected. Money in early compounds longest; the match is an instant 20% return. Whether the match is worth waiting for depends on your return assumption — see the tipping point below.`
  );

  if (diff >= 0) {
    lines.push(
      `<strong>If you had the full $50,000 on day one</strong> at ${ratePct}%: front-loading while feeding the match ends at <span class="highlight">${fmt(fullOptimal.balance)}</span>; going all-in in year one ends at ${fmt(fullLump.balance)}. The match wins by <span class="highlight">${fmt(diff)}</span>.`
    );
  } else {
    lines.push(
      `<strong>If you had the full $50,000 on day one</strong> at ${ratePct}%: going all-in in year one ends at <span class="highlight--amber">${fmt(fullLump.balance)}</span>; front-loading while feeding the match ends at ${fmt(fullOptimal.balance)}. Raw time in the market beats the grant by <span class="highlight--amber">${fmt(-diff)}</span>.`
    );
  }

  if (crossover !== null && crossover > 1) {
    lines.push(
      `<strong>The tipping point:</strong> starting at age ${startAge}, the CESG-fed plan wins below <span class="highlight">~${crossover}%</span> annual return; above that, all-in year one pulls ahead. Pick the return you actually believe in and act accordingly.`
    );
  } else if (crossover === null) {
    lines.push(
      `<strong>The tipping point:</strong> starting at age ${startAge}, the CESG-fed plan wins at every return rate up to 15% — feed the match.`
    );
  }

  if (lumpSum < LIFETIME_LIMIT) {
    lines.push(
      `<strong>Don't have $50k sitting around?</strong> Set the lump-sum slider to the cash you do have — the Max Gov Money Extraction plan re-times it to capture every grant dollar it can.`
    );
  }

  el.innerHTML =
    '<span class="ideal-state__title">Verdict · The Ideal State</span>' + lines.join('<br><br>');
}

function clearResults() {
  ['userContributions', 'userCESG', 'userGrowth', 'userTotal',
   'optimalContributions', 'optimalCESG', 'optimalGrowth', 'optimalTotal',
   'lumpContributions', 'lumpCESG', 'lumpGrowth', 'lumpTotal']
    .forEach((id) => { $(id).textContent = '$0'; });
  $('userCESGNote').innerHTML = '';
  $('lumpCESGNote').innerHTML = '';
  $('optimalDelta').textContent = '';
  $('lumpDelta').textContent = '';
  $('idealState').innerHTML = '';
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
      `<strong>Re-timing advantage:</strong> The Max Gov Money Extraction plan re-times the same cash to capture more CESG and compounding. At ${(parseFloat($('returnRateSlider').value)).toFixed(1)}% return, this adds <span class="highlight">${fmt(delta)}</span> by age 18.`
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

function renderChart(userResult, optimalResult, lumpResult, startAge) {
  const ctx = $('growthChart').getContext('2d');

  const userLabels = userResult.years.map((y) => `Age ${y.age}`);
  const labels = ['Start', ...userLabels];

  const userBalances = [0, ...userResult.years.map((y) => y.balance)];
  const optBalances = [0, ...optimalResult.years.map((y) => y.balance)];
  const lumpBalances = [0, ...lumpResult.years.map((y) => y.balance)];

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
      label: 'Max Gov Money Extraction',
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

  datasets.push({
    label: 'Max Lump & Forget',
    data: lumpBalances,
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    fill: true,
    tension: 0.3,
    pointRadius: 4,
    pointHoverRadius: 6,
    borderWidth: 2.5,
    borderDash: [2, 4],
  });

  if (growthChart) growthChart.destroy();

  growthChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: true, position: 'top' },
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

function renderCompositionChart(userResult, optimalResult, lumpResult) {
  const ctx = $('compositionChart').getContext('2d');

  const labels = ['Your Plan', 'Max Gov Extraction', 'Lump & Forget'];
  const datasets = [
    {
      label: 'Contributions',
      data: [userResult.totalContributions, optimalResult.totalContributions, lumpResult.totalContributions],
      backgroundColor: '#93c5fd',
      borderRadius: 4,
    },
    {
      label: 'CESG Grants',
      data: [userResult.totalCESG, optimalResult.totalCESG, lumpResult.totalCESG],
      backgroundColor: '#6ee7b7',
      borderRadius: 4,
    },
    {
      label: 'Investment Growth',
      data: [userResult.investmentGrowth, optimalResult.investmentGrowth, lumpResult.investmentGrowth],
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

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

// Node export for tests (no-op in the browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LIFETIME_LIMIT,
    CESG_RATE,
    CESG_ANNUAL_MAX,
    CESG_LIFETIME,
    CESG_ROOM_PER_YEAR,
    END_AGE,
    simulate,
    flatSchedule,
    computeOptimalSchedule,
    lumpAndForgetSchedule,
    describeOptimalSchedule,
  };
}

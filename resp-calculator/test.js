/* Tests for the RESP calculator model.
   Run with:  node test.js
   No framework — plain assertions, exits 1 on any failure. */

const {
  LIFETIME_LIMIT,
  CESG_LIFETIME,
  simulate,
  flatSchedule,
  computeOptimalSchedule,
  lumpAndForgetSchedule,
} = require('./calculator.js');

let failures = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function total(schedule) {
  return schedule.reduce((a, b) => a + b, 0);
}

console.log('CESG capture');
{
  // $2,500/yr from birth earns the full $500/yr grant until the $7,200 cap
  const r = simulate(0, flatSchedule(0, 2500), 0.08);
  check('newborn @ $2,500/yr collects full CESG', Math.round(r.totalCESG) === CESG_LIFETIME,
    `got ${r.totalCESG}`);

  // lump-and-forget only collects year-one CESG
  const l = simulate(0, lumpAndForgetSchedule(0), 0.08);
  check('lump & forget (newborn) gets only $500 CESG', Math.round(l.totalCESG) === 500,
    `got ${l.totalCESG}`);

  // late start with catch-up room can earn $1,000 in year one
  const late = simulate(5, lumpAndForgetSchedule(5), 0.08);
  check('lump & forget (age 5) gets $1,000 via catch-up room', Math.round(late.totalCESG) === 1000,
    `got ${late.totalCESG}`);
}

console.log('Lifetime limit');
{
  // contributions never exceed $50,000 no matter the inputs
  const configs = [
    [0, 50000, 16000],
    [3, 20000, 5000],
    [10, 50000, 0],
    [17, 50000, 16000],
    [0, 0, 50000],
  ];
  for (const [age, lump, annual] of configs) {
    const s = computeOptimalSchedule(age, lump, annual);
    check(`optimal schedule (age ${age}, $${lump} + $${annual}/yr) stays under cap`,
      total(s) <= LIFETIME_LIMIT + 0.01 && s.every((x) => x >= 0),
      `total ${total(s)}`);
  }

  const bigFlat = simulate(0, flatSchedule(0, 16000), 0.08);
  check('simulate clamps flat $16k/yr at lifetime cap',
    Math.round(bigFlat.totalContributions) === LIFETIME_LIMIT,
    `got ${bigFlat.totalContributions}`);
}

console.log('Optimal schedule behavior');
{
  // no spare cash: optimal must equal the user's flat plan
  const flat = flatSchedule(0, 2500);
  const opt = computeOptimalSchedule(0, 0, 2500);
  check('no lump, $2,500/yr → optimal equals flat plan',
    opt.every((v, i) => Math.abs(v - flat[i]) < 0.01));

  // full $50k on day one: front-load extra in year 1 but keep $2,500/yr flowing
  const full = computeOptimalSchedule(0, 50000, 0);
  check('full-lump optimal front-loads year 1 beyond $2,500', full[0] > 2500);
  check('full-lump optimal still collects full CESG',
    Math.round(simulate(0, full, 0.08).totalCESG) === CESG_LIFETIME,
    `got ${simulate(0, full, 0.08).totalCESG}`);
  check('full-lump optimal spends the whole $50k', Math.abs(total(full) - LIFETIME_LIMIT) < 0.01,
    `total ${total(full)}`);

  // optimal never spends cash it doesn't have yet
  const constrained = computeOptimalSchedule(5, 10000, 4000);
  let cash = 0;
  let overspent = false;
  for (let i = 0; i < constrained.length; i++) {
    cash += 4000 + (i === 0 ? 10000 : 0);
    if (constrained[i] > cash + 0.01) overspent = true;
    cash -= constrained[i];
  }
  check('constrained optimal respects cash flow (age 5, $10k + $4k/yr)', !overspent);

  // reshuffling the same money should never end lower than the flat plan
  const userSched = flatSchedule(5, 4000);
  userSched[0] += 10000;
  const userR = simulate(5, userSched, 0.06);
  const optR = simulate(5, computeOptimalSchedule(5, 10000, 4000), 0.06);
  check('optimal ≥ user plan with same cash', optR.balance >= userR.balance - 0.01,
    `opt ${Math.round(optR.balance)} vs user ${Math.round(userR.balance)}`);
}

console.log('Lump vs match crossover');
{
  // at low returns the CESG-fed plan must win; at high returns lump wins
  const fullOpt = computeOptimalSchedule(0, 50000, 0);
  const lump = lumpAndForgetSchedule(0);

  const low = { opt: simulate(0, fullOpt, 0.01), lump: simulate(0, lump, 0.01) };
  check('at 1% return, feeding the match beats lump & forget',
    low.opt.balance > low.lump.balance,
    `opt ${Math.round(low.opt.balance)} vs lump ${Math.round(low.lump.balance)}`);

  const high = { opt: simulate(0, fullOpt, 0.15), lump: simulate(0, lump, 0.15) };
  check('at 15% return, lump & forget beats feeding the match',
    high.lump.balance > high.opt.balance,
    `lump ${Math.round(high.lump.balance)} vs opt ${Math.round(high.opt.balance)}`);

  // report the crossover so a human can eyeball it
  for (let p = 1; p <= 15; p += 0.25) {
    const o = simulate(0, fullOpt, p / 100);
    const l = simulate(0, lump, p / 100);
    if (l.balance > o.balance) {
      console.log(`  info  newborn crossover rate: ~${p}%`);
      break;
    }
  }
}

console.log('Edge cases');
{
  check('age 18 start → empty schedules',
    computeOptimalSchedule(18, 50000, 5000).length === 0 &&
    lumpAndForgetSchedule(18).length === 0);

  const zero = simulate(0, flatSchedule(0, 0), 0.08);
  check('zero contributions → zero balance', zero.balance === 0 && zero.totalCESG === 0);

  const zeroRate = simulate(0, flatSchedule(0, 2500), 0);
  check('0% return → balance = contributions + CESG',
    Math.abs(zeroRate.balance - zeroRate.totalContributions - zeroRate.totalCESG) < 0.01);
}

console.log('');
if (failures) {
  console.error(`${failures} test(s) FAILED`);
  process.exit(1);
} else {
  console.log('All tests passed');
}

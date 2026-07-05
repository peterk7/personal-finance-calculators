// ── Loan constants ──

export const VEHICLE_TOTAL = 58736.69; // down payment + amount financed
export const APR = 4.99;
export const ORIGINAL_TERM = 60;
export const ORIGINAL_DOWN = 20000;
export const ORIGINAL_FINANCED = 38736.69;
export const ORIGINAL_PAYMENT = 730.93;
export const LUMP_SUM_TOTAL = 15000;
export const LOAN_START = new Date(2022, 11, 19); // Dec 19, 2022

// ── Utility functions ──

export function monthlyRate(apr) {
  return apr / 100 / 12;
}

export function calcPayment(principal, apr, termMonths) {
  const r = monthlyRate(apr);
  return principal * r * Math.pow(1 + r, termMonths) / (Math.pow(1 + r, termMonths) - 1);
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function fmt(n) {
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

export function monthLabel(m) {
  const d = new Date(LOAN_START);
  d.setMonth(d.getMonth() + m);
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short" });
}

export function dateToMonth(dateStr) {
  const d = new Date(dateStr);
  return (d.getFullYear() - LOAN_START.getFullYear()) * 12 + (d.getMonth() - LOAN_START.getMonth());
}

export function generateAmortization(principal, apr, termMonths, payment) {
  const r = monthlyRate(apr);
  let balance = principal;
  const schedule = [{ month: 0, balance, interest: 0, principalPaid: 0, payment: 0, cumulativeInterest: 0 }];
  let cumInterest = 0;

  for (let i = 1; i <= termMonths; i++) {
    const interestCharge = round2(balance * r);
    let principalPaid = round2(payment - interestCharge);

    if (balance <= payment) {
      principalPaid = balance;
      const finalPayment = round2(balance + interestCharge);
      cumInterest = round2(cumInterest + interestCharge);
      schedule.push({ month: i, balance: 0, interest: interestCharge, principalPaid, payment: finalPayment, cumulativeInterest: cumInterest });
      break;
    }

    balance = round2(balance - principalPaid);
    cumInterest = round2(cumInterest + interestCharge);
    schedule.push({ month: i, balance, interest: interestCharge, principalPaid, payment, cumulativeInterest: cumInterest });
  }

  return schedule;
}

// ── Actual payments (from P&I statement + final payments) ──

export const actualPayments = [
  { date: "2022-12-19", balance: 38736.69, payment: 0, interest: 0, type: "origination" },
  { date: "2023-01-19", balance: 38170.06, payment: 730.93, interest: 164.30, type: "regular" },
  { date: "2023-02-21", balance: 37611.39, payment: 730.93, interest: 172.26, type: "regular" },
  { date: "2023-03-20", balance: 37019.24, payment: 730.93, interest: 138.78, type: "regular" },
  { date: "2023-04-19", balance: 36440.11, payment: 730.93, interest: 151.80, type: "regular" },
  { date: "2023-05-19", balance: 35858.58, payment: 730.93, interest: 149.40, type: "regular" },
  { date: "2023-06-19", balance: 35279.55, payment: 730.93, interest: 151.90, type: "regular" },
  { date: "2023-07-19", balance: 34693.22, payment: 730.93, interest: 144.60, type: "regular" },
  { date: "2023-07-27", balance: 33693.22, payment: 1000.00, interest: 0, type: "lump_sum" },
  { date: "2023-08-21", balance: 33115.46, payment: 730.93, interest: 153.17, type: "regular" },
  { date: "2023-09-19", balance: 32515.90, payment: 730.93, interest: 131.37, type: "regular" },
  { date: "2023-10-19", balance: 31918.47, payment: 730.93, interest: 133.50, type: "regular" },
  { date: "2023-11-19", balance: 31322.70, payment: 730.93, interest: 135.16, type: "regular" },
  { date: "2023-11-21", balance: 27322.70, payment: 4000.00, interest: 0, type: "lump_sum" },
  { date: "2023-12-19", balance: 26705.05, payment: 730.93, interest: 113.28, type: "regular" },
  { date: "2024-01-19", balance: 26087.09, payment: 730.93, interest: 112.97, type: "regular" },
  { date: "2024-02-19", balance: 25466.52, payment: 730.93, interest: 110.36, type: "regular" },
  { date: "2024-03-19", balance: 24836.22, payment: 730.93, interest: 100.63, type: "regular" },
  { date: "2024-04-19", balance: 24210.38, payment: 730.93, interest: 105.09, type: "regular" },
  { date: "2024-05-19", balance: 23578.45, payment: 730.93, interest: 99.00, type: "regular" },
  { date: "2024-06-19", balance: 22947.03, payment: 730.93, interest: 99.51, type: "regular" },
  { date: "2024-07-19", balance: 22310.00, payment: 730.93, interest: 93.90, type: "regular" },
  { date: "2024-08-19", balance: 21673.31, payment: 730.93, interest: 94.24, type: "regular" },
  { date: "2024-09-19", balance: 21033.83, payment: 730.93, interest: 91.45, type: "regular" },
  { date: "2024-10-16", balance: 11111.32, payment: 10000.00, interest: 77.49, type: "lump_sum" },
  { date: "2024-10-19", balance: 10380.39, payment: 730.93, interest: 0, type: "regular" },
  { date: "2024-11-19", balance: 9698.01, payment: 730.93, interest: 48.55, type: "regular" },
  { date: "2024-12-19", balance: 9006.68, payment: 730.93, interest: 39.60, type: "regular" },
  { date: "2025-01-19", balance: 8313.88, payment: 730.93, interest: 38.13, type: "regular" },
  { date: "2025-02-19", balance: 7618.29, payment: 730.93, interest: 35.34, type: "regular" },
  { date: "2025-03-19", balance: 6916.48, payment: 730.93, interest: 29.12, type: "regular" },
  { date: "2025-04-19", balance: 6215.00, payment: 730.93, interest: 29.45, type: "regular" },
  { date: "2025-05-19", balance: 5509.57, payment: 730.93, interest: 25.50, type: "regular" },
  { date: "2025-06-19", balance: 4801.89, payment: 730.93, interest: 23.25, type: "regular" },
  { date: "2025-07-19", balance: 4090.76, payment: 730.93, interest: 19.80, type: "regular" },
  { date: "2025-08-19", balance: 3377.19, payment: 730.93, interest: 17.36, type: "regular" },
  { date: "2025-09-19", balance: 2660.52, payment: 730.93, interest: 14.26, type: "regular" },
  { date: "2025-10-19", balance: 1940.39, payment: 730.93, interest: 10.80, type: "regular" },
  { date: "2025-11-19", balance: 1217.68, payment: 730.93, interest: 8.22, type: "regular" },
  { date: "2025-12-19", balance: 491.74, payment: 730.93, interest: 4.99, type: "regular" },
  { date: "2026-01-20", balance: 0, payment: 494.94, interest: 3.20, type: "payoff" },
];

// ── Computed scenarios ──

// Scenario 1: Standard (no lump sums, full 60-month term)
export const scenario1 = generateAmortization(ORIGINAL_FINANCED, APR, ORIGINAL_TERM, ORIGINAL_PAYMENT);
export const s1 = {
  schedule: scenario1,
  totalInterest: scenario1[scenario1.length - 1].cumulativeInterest,
  totalPaid: round2(ORIGINAL_DOWN + scenario1.reduce((s, e) => s + e.payment, 0)),
  endMonth: scenario1[scenario1.length - 1].month,
  down: ORIGINAL_DOWN,
  financed: ORIGINAL_FINANCED,
  payment: ORIGINAL_PAYMENT,
};

// Scenario 2: Actual aggressive payoff
export const s2Data = actualPayments.map(p => ({
  month: dateToMonth(p.date),
  date: p.date,
  balance: p.balance,
  interest: p.interest,
  payment: p.payment,
  type: p.type,
}));

let _s2CumInterest = 0;
s2Data.forEach(p => {
  _s2CumInterest = round2(_s2CumInterest + p.interest);
  p.cumulativeInterest = _s2CumInterest;
});

export const s2 = {
  data: s2Data,
  totalInterest: _s2CumInterest,
  totalPayments: round2(actualPayments.slice(1).reduce((s, p) => s + p.payment, 0)),
  totalPaid: round2(ORIGINAL_DOWN + actualPayments.slice(1).reduce((s, p) => s + p.payment, 0)),
  endMonth: s2Data[s2Data.length - 1].month,
  down: ORIGINAL_DOWN,
  financed: ORIGINAL_FINANCED,
  payment: ORIGINAL_PAYMENT,
};

// Scenario 3: Higher down payment ($35K), 60-month term
export const S3_DOWN = ORIGINAL_DOWN + LUMP_SUM_TOTAL;
export const S3_FINANCED = round2(ORIGINAL_FINANCED - LUMP_SUM_TOTAL);
export const S3_PAYMENT = round2(calcPayment(S3_FINANCED, APR, ORIGINAL_TERM));

const scenario3 = generateAmortization(S3_FINANCED, APR, ORIGINAL_TERM, S3_PAYMENT);
export const s3 = {
  schedule: scenario3,
  totalInterest: scenario3[scenario3.length - 1].cumulativeInterest,
  totalPaid: round2(S3_DOWN + scenario3.reduce((s, e) => s + e.payment, 0)),
  endMonth: scenario3[scenario3.length - 1].month,
  down: S3_DOWN,
  financed: S3_FINANCED,
  payment: S3_PAYMENT,
};

// Scenario 4: Higher down payment ($35K), 37-month term
export const S4_DOWN = S3_DOWN;
export const S4_FINANCED = S3_FINANCED;
export const S4_TERM = s2.endMonth;
export const S4_PAYMENT = round2(calcPayment(S4_FINANCED, APR, S4_TERM));

const scenario4 = generateAmortization(S4_FINANCED, APR, S4_TERM, S4_PAYMENT);
export const s4 = {
  schedule: scenario4,
  totalInterest: scenario4[scenario4.length - 1].cumulativeInterest,
  totalPaid: round2(S4_DOWN + scenario4.reduce((s, e) => s + e.payment, 0)),
  endMonth: scenario4[scenario4.length - 1].month,
  down: S4_DOWN,
  financed: S4_FINANCED,
  payment: S4_PAYMENT,
};

// ── Lump-sum timing (used by opportunity cost page) ──

export const LUMP_SUMS = [
  { month: 7,  amount: 1000  },  // Jul 2023
  { month: 11, amount: 4000  },  // Nov 2023
  { month: 22, amount: 10000 },  // Oct 2024
];

export function compoundGrowth(principal, annualRate, months) {
  const r = annualRate / 100 / 12;
  return principal * Math.pow(1 + r, months);
}

// Interest saved by aggressive payoff vs standard 60-month term
export const INTEREST_SAVED = round2(s1.totalInterest - s2.totalInterest);

// ── Chart colors (shared across pages) ──

export const CHART_COLORS = {
  standard: { line: "#94a3b8", fill: "rgba(148,163,184,0.08)" },
  actual:   { line: "#10b981", fill: "rgba(16,185,129,0.08)" },
  higherDp: { line: "#3b82f6", fill: "rgba(59,130,246,0.08)" },
  shorter:  { line: "#8b5cf6", fill: "rgba(139,92,246,0.08)" },
};

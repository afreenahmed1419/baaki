// All tunable rules live here. Amounts are whole paise.
export const CONFIG = {
  // NOTE: GST rates change. Check current rates on cbic-gst.gov.in before the demo.
  // Main slabs since 22 Sep 2025: 0%, 5%, 18%, plus 3% (precious metals) and 40% (sin/luxury goods).
  gstRates: [0, 3, 5, 18, 40],

  // Payment Demand Letter: days given to pay, counted from the letter date.
  demandDeadlineDays: 7,

  // NOTE: RBI bank rate (%). Check rbi.org.in for the current value before the demo.
  rbiBankRatePct: 5.5,
  // MSMED Act, 2006 s.16: compound interest with monthly rests at 3x the bank rate.
  msmedInterestMultiplier: 3,
  msmedMaxCreditDays: 45,

  // Escalation ladder: offset = days relative to due date (negative = before).
  ladder: [
    { id: 'heads_up', offset: -3, kind: 'message' },
    { id: 'reminder', offset: 0, kind: 'message' },
    { id: 'firm', offset: 7, kind: 'message' },
    { id: 'final', offset: 15, kind: 'message' },
    { id: 'demand', offset: 30, kind: 'letter' },
    { id: 'next_steps', offset: 45, kind: 'advice' },
  ],

  // Cash forecast
  forecastWeeks: 13,
  safetyBufferPaise: 15000000, // Rs 1,50,000
  dueSoonDays: 7,

  // e-invoicing (IRN) applies above this turnover (Rs 5 crore). HSN: 4 digits up to it, 6 above.
  eInvoiceTurnoverPaise: 500_00_00_000,

  // Possible TDS shortfall percentages (of taxable value)
  tdsPercents: [1, 2, 10],

  // Cash Rescue Plan. ASSUMPTIONS: ask your bank/supplier for the real figures.
  overdraftAprPct: 18,              // yearly interest on unsecured working-capital credit (typical 14-24%)
  supplierDelayFeePctPerMonth: 1.5, // late fee a supplier may charge if you pay 14 days late
  supplierDelayDays: 14,
  offerDefaultBp: 200,              // early-payment discount offered, in basis points (200 = 2%)
  offerWindowDays: 5,               // customer must pay within this many days of the offer
  offerMinDaysEarlier: 14,          // an offer only makes sense if it pulls cash in at least this much sooner
  overdraftRoundPaise: 10_000_00,   // overdraft is sized in steps of Rs 10,000

  // The sample data is built around this date. Settings > Demo date moves "today".
  demoToday: '2026-10-23',
}

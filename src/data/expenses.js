// Money going out. 'monthly' repeats on `day` of each month; 'once' happens on `date`.
const rs = (rupees) => rupees * 100

export const expenses = [
  { id: 'x1', label: 'Salaries (8 staff)', kind: 'salary', type: 'monthly', day: 1, amountPaise: rs(2_40_000) },
  { id: 'x2', label: 'Factory rent', kind: 'rent', type: 'monthly', day: 5, amountPaise: rs(45_000) },
  { id: 'x3', label: 'Electricity', kind: 'utility', type: 'monthly', day: 12, amountPaise: rs(34_000) },
  { id: 'x4', label: 'GST payment (monthly filer)', kind: 'gst', type: 'monthly', day: 20, amountPaise: rs(78_000) },
  { id: 'x5', label: 'Loan EMI', kind: 'loan', type: 'monthly', day: 7, amountPaise: rs(38_000) },
  { id: 's1', label: 'Ambika Paper Mills: kraft paper', kind: 'supplier', type: 'once', date: '2026-10-28', amountPaise: rs(3_10_000) },
  { id: 's2', label: 'Ambika Paper Mills: kraft paper', kind: 'supplier', type: 'once', date: '2026-11-18', amountPaise: rs(3_40_000) },
  { id: 's3', label: 'Om Adhesives: gum and starch', kind: 'supplier', type: 'once', date: '2026-11-10', amountPaise: rs(82_000) },
  { id: 's4', label: 'Ambika Paper Mills: kraft paper', kind: 'supplier', type: 'once', date: '2026-12-09', amountPaise: rs(5_80_000) },
  { id: 's5', label: 'Metro Machine Works: press repair', kind: 'supplier', type: 'once', date: '2026-12-16', amountPaise: rs(1_20_000) },
  { id: 's6', label: 'Ambika Paper Mills: kraft paper', kind: 'supplier', type: 'once', date: '2027-02-05', amountPaise: rs(3_30_000) },
]

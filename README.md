# Baaki: chase the money you are owed, see a cash shortage coming

**Problem.** A small business in India sells on credit and gets paid weeks late. The owner loses track of who owes what, forgets to follow up, does not know how to escalate politely, and only finds out about a cash shortage when salaries are due.

**Who it is for.** The owner of a small GST-registered business without an accounts team. The demo is *Sharma Packaging*, a made-up carton maker in Pune with 8 employees and 12 business customers on 30-day credit.

Baaki tells the owner exactly **who to chase today, how, and why**, writes the GST invoice and the demand letter, matches incoming payments, and shows a cash shortage **weeks before it happens**, with the invoices that would close the gap.

> Everything is made up: business, customers, GSTINs, phone numbers, bank details. Baaki connects to no bank, GST or messaging system. Money and tax are exact whole-paise integers, never decimals.

## What each screen does

| Screen | What it does |
|---|---|
| **Home** | Money to collect, overdue, expected this week and month, bills due in 30 days, cash, lowest forecast point, an ageing bar (not due, 1-30, 31-60, 61-90, 90+) and the top 5 to chase. A red banner appears when cash will run short. |
| **Invoices** | Search and filter by customer, status, due date, days overdue. Statuses: draft, sent, due soon, overdue, part paid, paid, disputed. Each invoice has a timeline and its follow-up steps. |
| **New invoice** | Pick or add a customer (GSTIN checked, state taken from it). Items with HSN/SAC, quantity, rate, discount, GST rate. Live totals, UPI QR code, print-ready A4 preview. **Add from a photo or PDF** fills the form using AI for the owner to check. |
| **Customers** | Credit days, preferred language, average days late, % on time, and an A/B/C grade with the reason in words. |
| **Follow-ups** | The reminders due today, message ready (English or Hindi). One tap opens WhatsApp, email or SMS with the text filled in. Mark as sent, snooze, or record "customer promised to pay". |
| **Customer link** `/pay/:token` | What the customer sees, no login: the invoice, Pay by UPI (simulated), "I have already paid" with a reference, "Something is wrong". The last two pause reminders and land in the Inbox. |
| **Inbox** | Disputes and "already paid" claims. Accept (credit note or mark paid), reject with a reply, or edit the invoice. Resolving resumes or stops the ladder. |
| **Payments** | Import a bank-statement CSV. Each credit is matched to invoices with a confidence and the reason. Part payments, one payment for several invoices, overpayments, unmatched deposits and possible TDS are flagged. Nothing is paid until the owner confirms. |
| **Rescue plan** | The cheapest, tested way to close a forecast cash gap: supplier time, early-payment offers sent to customers, then a small overdraft. See below. |
| **Cash forecast** | 13 weeks, opening cash, money in, money out, closing cash. Highlights the first week under the safety buffer, "what if" switches, and the invoices that would cover the gap. |
| **Chase these first** | A 0-100 score per overdue invoice with the reason in plain words. |
| **Documents** | Per invoice: every record in one timeline, plus a print-ready **evidence pack**. |
| **Speak** (floating button) | Hindi, Hinglish and English voice or typed commands: record a payment, who to chase, how much is owed, when cash runs short. |
| **Settings** | Business profile, ladder days, safety buffer, language (English / हिंदी), text size, demo date, reset. |

## The X-factor: Cash Rescue Plan

Most tools show a cash shortage. Baaki says **what to do about it, and what each option costs**, then proves it against your own forecast.

1. **It finds the gap.** For example: short by ₹5.9 lakh in week 8.
2. **It picks the cheapest levers, in order.** Ask a supplier for 14 more days (only if that helps), then **early-payment discounts** to the customers whose money would arrive *after* the gap, then a small **overdraft** for whatever is left, sized in ₹10,000 steps.
3. **It prices every option with exact rupees.** A discount is only offered if it costs clearly less than borrowing the same money for the same days (at least 10% cheaper). The offer is timed to land just before the gap, because a discount is a fixed percentage however early the customer pays. The discount is the largest of 2.5%, 2%, 1.5% or 1% that still beats borrowing, rounded to whole rupees. The card also shows what the customer earns a year for paying early, so the offer is realistic.
4. **It re-runs the forecast with the plan applied** and only says "tested" if cash never drops below the safety buffer.
5. **It closes the loop with the customer.** The offer goes out as a message. On the customer's pay link they see "Pay early, take 1.5% off", choose the date they will pay, and accept. That creates a promise (reminders pause), puts a note in the owner's Inbox, and the **forecast immediately uses the discounted amount and the promised date**, so the shortfall shrinks live. When the money arrives, bank matching recognises a payment short by exactly the offered discount and applies it.

On the sample data the plan closes the gap for about ₹9.5k against about ₹12.2k for borrowing everything, and 83% of the gap closes without a loan. The assumptions (overdraft 18% a year, supplier late fee 1.5% a month) are in `src/config.js`: replace them with your bank's real figures.

## Talk to it in Hindi (voice)

Tap **Speak** (bottom right) and say or type, in Hindi, Hinglish or English:

| Say | What happens |
|---|---|
| "पाटिल ने 50000 दिए" / "Patil paid 2 lakh" | Finds the customer and invoices, shows where the money goes, and records it **only after you press Confirm**. |
| "आज किसको फ़ोन करूँ?" | Reads out the top 3 customers to chase today. |
| "कुल कितना बाकी है?" / "शिंदे का कितना बाकी है?" | Total or per-customer amount owed and overdue. |
| "नकदी कब कम पड़ेगी?" | The cash forecast, with a link to the Rescue Plan. |

It understands amounts such as "50,000", "2.5 lakh", "ढाई लाख", "पचास हज़ार", and customer names in Latin or Devanagari with spelling variants (पाटिल, पाटील, शिंदे, शिन्दे). It is rule-based on purpose: it works offline, needs no AI key, and cannot do anything by itself. Speech recognition uses the browser (Chrome works best, and needs HTTPS or localhost); where it is not supported you can type the same commands. Answers can be read aloud.

## How GST is worked out

- Amounts are **whole paise** (integers). Display uses Indian grouping (₹1,00,000) and the total is also written in words ("Rupees One Lakh Eighteen Thousand Only").
- Tax is worked out **per line** on its taxable value (quantity x rate minus discount), rounded to the paisa.
- **Same state** (business state code equals place-of-supply state code): CGST and SGST, each half the rate, each rounded separately. **Other state**: IGST at the full rate. The first two digits of a GSTIN are the state code.
- Rates live in `src/config.js` (0, 3, 5, 18, 40). **Check current rates on cbic-gst.gov.in before the demo.**
- The grand total is rounded to the nearest rupee with a separate **Round off** line.
- What is issued comes from the business profile: **Regular** issues a *Tax Invoice*; **Composition** issues a *Bill of Supply* ("Composition taxable person, not eligible to collect tax on supplies") with no GST; **Unregistered** issues a plain invoice with no GST.
- Every GSTIN is checked for pattern and **check digit**. Invoice numbers are like `INV/26-27/0001`: at most 16 characters, consecutive within the financial year (1 April to 31 March), never reused.
- e-invoicing (IRN) applies above ₹5 crore turnover. Baaki does not generate IRNs; the invoice screen says so when the profile turnover is above that.

Verified in `scripts/check-gst.mjs`: ₹10,000 at 18% gives CGST ₹900 + SGST ₹900 = ₹11,800 in the same state and IGST ₹1,800 = ₹11,800 in another state; 3 x ₹333 at 5%; a 10% discount; composition; 0% items.

## The follow-up ladder, and why the letter is not a legal notice

Default steps (editable in Settings, defaults in `src/config.js`): 3 days before due (friendly heads-up), on the due date (reminder), 7 days overdue (firmer), 15 days (final, plus prompt to call), 30 days (**Payment Demand Letter**), 45 days (next-steps suggestion: call, consult a lawyer, MSME Samadhaan if registered). The tone steps up slowly and stays polite.

Rules: a dispute, an "already paid" claim or a promise to pay **pauses** the ladder; the same step is **never sent twice**; days are counted in whole IST days from the due date; a part payment keeps the step but updates the amount in the message.

The **Payment Demand Letter** is clearly from the business and says so on every copy: *"This letter is from Sharma Packaging about money owed for the invoices listed below. It is not a notice from the GST department and not a legal notice from a lawyer."* It is never called a legal notice and has no emblem, seal or lawyer wording. It lists each invoice with part payments and what is still owed, a deadline 7 days out, bank details and a UPI QR, and a dispute contact.

For a Udyam-registered micro or small enterprise the letter adds one factual line about the MSMED Act, 2006 (pay within the agreed period, at most 45 days, interest on late payment) and shows interest as a **separate** figure: compound interest with monthly rests at 3x the RBI bank rate (kept in `config.js`, **check rbi.org.in**). It is added to the amount requested only if the owner ticks a box.

## How payments are matched, the forecast, and the "chase" score

- **Matching.** Finds the invoice number in the bank description even with different spacing (`INV/26-27/0012`, `INV 26-27 12`), compares amounts in paise, matches customer names loosely (ignores M/s, Pvt, Ltd, capitals), covers several invoices oldest-first unless the text names them, and flags a shortfall of exactly 1%, 2% or 10% of the taxable value as **possible TDS** ("ask for the TDS certificate"). Re-importing a file counts nothing twice (date + amount + reference).
- **Forecast.** Each unpaid invoice is expected on its due date plus how late that customer usually pays; invoices already later than that are pushed out further, in proportion to how late they already are. Disputed invoices and invoices over 60 days late are *not* counted (collecting them is upside). Money out comes from `src/data/expenses.js` (salaries, rent, loan, GST, supplier bills). Each week's closing cash equals the next week's opening cash. New future sales are not included.
- **Chase score (0-100).** Points for the amount owed (capped at ₹2 lakh), days overdue, how unreliable the customer is, and whether collecting it helps close the cash gap. Paused invoices are ranked lower. The reason is shown in words, for example "₹2,33,804, 91 days overdue, customer usually pays 20 days late, collecting it helps cover the cash gap from week 8".

## How it improves on chasing by hand

Today the owner remembers, scrolls WhatsApp, guesses the tone, and learns of a shortfall on salary day. Baaki gives a daily list with ready messages, a fixed polite-to-firm ladder, a paper trail for every invoice, payments matched to invoices, and a 13-week view that turns "we are short in December" into "collect these three invoices now".

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # money/GST, ladder, matching, rescue plan, voice, i18n, and a render of every screen in both languages
npm run e2e        # real-browser test (needs npm run dev running): offer sent, customer accepts, forecast updates live, Hindi voice payment
npm run shots      # screenshots of every screen on phone and laptop + console-error check
npm run build
```

Works on a phone (360px wide) and a laptop. Design: a bold editorial look (newsprint paper, ink black, one red for money owed, big tabular numerals, square corners), fonts bundled locally so it works offline. Data lives in `localStorage`; **Settings > Reset demo** restores the sample data. **Settings > Demo date** moves "today" so you can watch reminders, letters and the forecast change.

### Photo-to-invoice (optional, needs an AI key)

Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. The key stays on the server (`api/read-invoice.js`), never in the browser. The file is read in memory and not kept. The form is filled for the owner to review: uncertain fields are highlighted with "Please check this", GST is recalculated from the items and compared with the printed totals, and the GSTIN check digit is verified. Without a key the rest of the app works and the button shows a clear message.

Try it: open an invoice from the app, **Open / Save as PDF**, photograph or save the page, then upload it on *New invoice*.

## What is simulated

No bank, GST portal, WhatsApp or email service is connected. Sending opens the owner's own WhatsApp/email/SMS app with the message filled in (`wa.me`, `mailto:`, `sms:`), and "Mark as sent" logs it. UPI payment on the customer link is a demo. The customer link works in the same browser because data is in `localStorage`.

## What we would build next

Real WhatsApp Business templates and scheduled sending, a bank-feed integration (Account Aggregator), a shared database so the customer link works on the customer's own phone, multi-user accounts, GST e-invoicing (IRN) and e-way bills, and Marathi and other languages.

## Put it online (Vercel)

1. Push this folder to a GitHub repository.
2. In Vercel: **Add New > Project**, import the repository. Framework: **Vite**, build command `npm run build`, output folder `dist` (the defaults).
3. If you want photo-to-invoice, add the environment variable `ANTHROPIC_API_KEY` under **Settings > Environment Variables**, then redeploy.
4. `vercel.json` already contains the rewrite that sends every path to `index.html`, so refreshing on `/pay/...` or `/invoices` does not show a 404. On Netlify, `public/_redirects` does the same.
5. Open the deployed link once and press **Settings > Reset demo** before judging.

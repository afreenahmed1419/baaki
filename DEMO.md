# 3-minute demo script

**Set-up (before judges arrive):** press **Settings > Reset demo**, language English, laptop view. Open a **second browser tab** (same browser) ready to paste the customer link. Use **Chrome** if you want the microphone to work.

The story in one line: *most tools show you a cash shortage; Baaki tells you how to fix it, what it costs, and the customer can say yes in one tap.*

---

**0:00 The problem** (20 s)
Home. "Rakesh runs Sharma Packaging. He is owed ₹25 lakh." Point at the red block: **Short by ₹5.9L in week 8.** "He would normally find this out on salary day. Baaki sees it eleven weeks early. But a warning is not a plan."

**0:20 The Rescue Plan: the X-factor** (50 s)
Press **Fix this**. Read the three lines:
- "Offer 1.5% off to two customers whose money would arrive after the gap."
- "Borrow only what is left: ₹1 lakh for 42 days."
- Point at the strip: **lowest cash −₹4.4L becomes ₹1.5L**, and the green tick: *tested against your forecast*.
- Point at the cost box: **₹9.5k instead of ₹12.2k for borrowing everything.** "Every discount is cheaper than borrowing for the same days, and it is timed to land just before the gap."

**1:10 The customer says yes** (50 s)
Press **Send offer on WhatsApp** on Nagpur Oranges (a WhatsApp tab opens with the message filled in). Copy the customer link from the invoice page (Invoices > INV/26-27/0001) into the second tab. The customer sees **"Pay early, take 1.5% off"** (in Hindi, their language). Press **Accept the offer**. Switch back to the first tab: **it already says "Accepted: will pay by…" and the shortfall number has dropped**, with a note in Inbox. "The customer's promise went straight into the forecast. When the money arrives, the bank statement recognises the discount automatically."

**2:00 Speak to it in Hindi** (30 s)
Press **Speak**. Say or type **"पाटिल ने 50000 दिए"**. It shows where the money goes. "It never records anything until I confirm." Press Confirm. Then ask **"आज किसको फ़ोन करूँ?"** and it reads out who to chase. "Shopkeepers do not type. They talk."

**2:30 It is still a proper accounts tool** (25 s)
Quick flicks, one sentence each: **Payments** (six bank-statement cases including a possible-TDS short payment), **New invoice** (same-state CGST + SGST versus other-state IGST, total in words), **Follow-ups** (a polite-to-firm ladder that pauses on a dispute), **Demand letter** ("not a GST notice, not a legal notice").

**2:55 Close** (5 s)
"Baaki: know who to chase, what to say, and exactly how to close the cash gap."

---

## If a judge asks

| Question | Answer |
|---|---|
| "Is the saving real or made up?" | It re-runs the 13-week forecast with the plan applied, and each discount must cost at least 10% less than borrowing the same money for the same days. The only assumptions are the overdraft rate (18%) and supplier late fee, both in `src/config.js`. |
| "What if customers say no?" | The page says so: if nobody accepts, borrowing the whole gap costs ₹12.2k. The plan is also re-calculated every time someone accepts or declines. |
| "Why would a customer accept?" | The card shows what they earn: about 12.6% a year for paying early, more than most small businesses earn on spare cash. |
| "Does voice need an AI key?" | No. It is rule-based, works offline, understands Hindi, Hinglish and English, and cannot act without a Confirm. |
| "Is the demand letter a legal notice?" | No, and every letter says so in its first lines. |
| "Is any of this connected to a bank?" | No. Everything is simulated with made-up data, as the brief allows. |

## What could go wrong, and how to avoid it

| Risk | How to avoid it |
|---|---|
| Demo data changed in an earlier run | **Settings > Reset demo** just before judging. |
| The "today" date is not the sample date | Settings > Demo date > **Back to start date**. |
| The customer link shows "link not valid" | Data is in this browser's `localStorage`. Open the link in a second tab of the **same browser**, not another browser or phone. Say: "with a shared database this works on any phone". |
| The microphone does not work | Use Chrome, allow the mic, and use localhost or HTTPS. Otherwise just **type** the same sentence in the box: the result is identical. Allow pop-ups so WhatsApp can open. |
| WhatsApp or mail app does not open | Allow pop-ups for the site, or show the message text and press Mark as sent. |
| Photo-to-invoice has no key or no internet | It is a bonus. Everything else works offline. Have a screenshot of a successful read ready. |
| Large text setting left on | Settings > Text size > Normal. |
| GST or RBI rate changed | Check cbic-gst.gov.in and rbi.org.in; update `src/config.js`. |
| Print dialog shows extra furniture | Turn off "Headers and footers" and pick "Save as PDF". |
| Deployed link 404s on refresh | `vercel.json` must be deployed (see README). |

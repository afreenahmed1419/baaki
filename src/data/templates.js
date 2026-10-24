// Reminder messages for each ladder step, in English and Hindi.
// Placeholders: {contact} {business} {owner} {phone} {invoices} {amount} {due} {days} {link} {deadline}
// Tone steps up slowly and stays polite. Nothing here is a legal or GST notice.
export const TEMPLATES = {
  en: {
    heads_up: 'Hello {contact}, a friendly heads-up from {business}: invoice {invoices} for {amount} falls due on {due}. You can see it and pay here: {link}\nThank you!\n{owner}, {phone}',
    reminder: 'Hello {contact}, this is a reminder from {business}: invoice {invoices} for {amount} is due today ({due}). Details and payment: {link}\nIf you have already paid, please let us know at the same link. Thank you.\n{owner}, {phone}',
    firm: 'Hello {contact}, invoice {invoices} for {amount} from {business} is now {days} days overdue (due {due}). Please arrange payment this week: {link}\nIf anything is wrong with the invoice, tell us there and we will sort it out.\n{owner}, {phone}',
    final: 'Hello {contact}, this is our final reminder about invoice {invoices}, {amount}, now {days} days overdue. Please pay within 7 days, or call us on {phone} to agree a date. Details: {link}\n{owner}, {business}',
    offer: 'Hello {contact}, a small thank-you offer from {business}: pay invoice {invoices} by {payBy} and take {pct} off. You pay {net} instead of {amount} (you save {discount}). See it and accept here: {link}\n{owner}, {phone}',
    demand: 'Hello {contact}, we have prepared a Payment Demand Letter from {business} for {amount} across invoice(s) {invoices} ({days} days overdue). Please pay by {deadline}. Letter and payment details: {link}\nIf you disagree with any amount, call us on {phone} before that date.\n{owner}, {business}',
  },
  hi: {
    heads_up: 'नमस्ते {contact} जी, {business} की ओर से एक छोटी सूचना: बिल {invoices}, राशि {amount}, {due} को देय है। बिल देखने और भुगतान के लिए: {link}\nधन्यवाद!\n{owner}, {phone}',
    reminder: 'नमस्ते {contact} जी, {business} की ओर से याद दिलाना: बिल {invoices}, राशि {amount}, आज ({due}) देय है। विवरण और भुगतान: {link}\nयदि आप भुगतान कर चुके हैं तो कृपया इसी लिंक पर बता दें। धन्यवाद।\n{owner}, {phone}',
    firm: 'नमस्ते {contact} जी, {business} का बिल {invoices}, राशि {amount}, अब {days} दिन से बकाया है (देय तिथि {due})। कृपया इसी सप्ताह भुगतान करें: {link}\nबिल में कोई गड़बड़ी हो तो वहीं बताएँ, हम ठीक कर देंगे।\n{owner}, {phone}',
    final: 'नमस्ते {contact} जी, बिल {invoices}, राशि {amount}, {days} दिन से बकाया है। यह हमारी अंतिम याद दिलाई है। कृपया 7 दिन में भुगतान करें या {phone} पर बात करके तारीख तय करें। विवरण: {link}\n{owner}, {business}',
    offer: 'नमस्ते {contact} जी, {business} की ओर से एक छोटा धन्यवाद-प्रस्ताव: बिल {invoices} का भुगतान {payBy} तक करें और {pct} की छूट पाएँ। आप {amount} की जगह {net} देंगे (आपकी बचत {discount})। यहाँ देखें और स्वीकार करें: {link}\n{owner}, {phone}',
    demand: 'नमस्ते {contact} जी, {business} की ओर से बिल {invoices} के लिए {amount} (अब {days} दिन बकाया) का "भुगतान माँग पत्र" तैयार किया गया है। कृपया {deadline} तक भुगतान करें। पत्र और भुगतान विवरण: {link}\nकिसी राशि पर आपत्ति हो तो उस तारीख से पहले {phone} पर बताएँ।\n{owner}, {business}',
  },
}

export const SUBJECTS = {
  en: {
    heads_up: 'Invoice {invoices} falls due on {due}',
    reminder: 'Reminder: invoice {invoices} is due today',
    firm: 'Invoice {invoices} is {days} days overdue',
    final: 'Final reminder: invoice {invoices}',
    demand: 'Payment Demand Letter: {amount} outstanding',
    offer: 'Save {discount} on invoice {invoices}: pay by {payBy}',
  },
  hi: {
    heads_up: 'बिल {invoices} {due} को देय है',
    reminder: 'याद दिलाना: बिल {invoices} आज देय है',
    firm: 'बिल {invoices} {days} दिन से बकाया है',
    final: 'अंतिम याद दिलाई: बिल {invoices}',
    demand: 'भुगतान माँग पत्र: {amount} बकाया',
    offer: 'बिल {invoices} पर {discount} बचाएँ: {payBy} तक भुगतान करें',
  },
}

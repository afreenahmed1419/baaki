import { CONFIG } from '../config.js'
import { business } from './business.js'
import { customers } from './customers.js'
import { invoices, payments, events, inbox } from './invoices.js'
import { expenses } from './expenses.js'

export function makeSeedDb() {
  return JSON.parse(JSON.stringify({
    business, customers, invoices, payments, events, inbox, expenses,
    promises: [],
    snoozes: {},
    importedKeys: [],
    unapplied: [],
    settings: {
      lang: 'en',
      textSize: 'normal',
      demoDate: CONFIG.demoToday,
      bufferPaise: CONFIG.safetyBufferPaise,
      ladder: CONFIG.ladder,
    },
  }))
}

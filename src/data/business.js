import { makeGstin } from '../lib/gst.js'

// Everything here is made up.
export const business = {
  name: 'Sharma Packaging',
  owner: 'Rakesh Sharma',
  address: 'Plot 14, MIDC Bhosari, Pune, Maharashtra 411026',
  state: 'Maharashtra',
  stateCode: '27',
  gstin: makeGstin('27AAKFS4821R1Z'),
  registration: 'regular', // regular | composition | unregistered
  turnoverPaise: 3_20_00_000 * 100, // Rs 3.2 crore
  udyam: true,
  udyamNo: 'UDYAM-MH-26-0012345',
  udyamCategory: 'small', // micro | small
  phone: '+91 98000 00001',
  email: 'accounts@sharmapackaging.example',
  upi: 'sharmapackaging@examplebank',
  bank: {
    accountName: 'Sharma Packaging',
    bankName: 'Example Bank, Bhosari Branch',
    accountNo: '000123456789',
    ifsc: 'EXMP0000123',
  },
  cashPaise: 4_20_000 * 100, // cash in the bank on the demo date
  employees: 8,
}

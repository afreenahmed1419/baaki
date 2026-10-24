import { makeGstin } from '../lib/gst.js'

// history = days late (negative = early) on the last 6 paid invoices. All made up.
const ON_TIME = [0, -1, 2, 0, 1, -2]
const SLIGHT = [4, 6, 3, 7, 5, 4]
const LATE = [18, 22, 20, 25, 19, 21]
const VERY_LATE = [32, 38, 35, 41, 30, 36]

export const customers = [
  { id: 'c1', aliases: ["पाटिल","पाटील","पाटिल फूड्स"], name: 'Patil Foods Pvt Ltd', contact: 'Sunita Patil', phone: '+91 98000 10001', email: 'accounts@patilfoods.example', address: 'Gat 22, Chakan, Pune, Maharashtra 410501', stateCode: '27', gstin: makeGstin('27AABCP1234A1Z'), creditDays: 30, lang: 'en', history: ON_TIME },
  { id: 'c2', aliases: ["देशमुख","देशमुख एग्रो"], name: 'Deshmukh Agro Industries', contact: 'Anil Deshmukh', phone: '+91 98000 10002', email: 'anil@deshmukhagro.example', address: 'MIDC Satpur, Nashik, Maharashtra 422007', stateCode: '27', gstin: makeGstin('27AAECD5678B1Z'), creditDays: 30, lang: 'en', history: ON_TIME },
  { id: 'c3', aliases: ["गुजरात","गुजरात स्नैक्स","शाह","हिरेन"], name: 'Gujarat Snacks Co', contact: 'Hiren Shah', phone: '+91 98000 10003', email: 'hiren@gujsnacks.example', address: 'GIDC Vatva, Ahmedabad, Gujarat 382445', stateCode: '24', gstin: makeGstin('24AAGCG2345C1Z'), creditDays: 30, lang: 'en', history: LATE },
  { id: 'c4', aliases: ["कुलकर्णी","कुलकर्णी इलेक्ट्रिकल्स","मीरा"], name: 'Kulkarni Electricals', contact: 'Meera Kulkarni', phone: '+91 98000 10004', email: 'meera@kulkarnielec.example', address: 'Hadapsar Industrial Estate, Pune, Maharashtra 411013', stateCode: '27', gstin: makeGstin('27AAFFK3456D1Z'), creditDays: 30, lang: 'en', history: [10, 14, 11, 13, 12, 12] },
  { id: 'c5', aliases: ["भोसले","भोंसले","भोसले गारमेंट्स","प्रकाश"], name: 'Bhosale Garments', contact: 'Prakash Bhosale', phone: '+91 98000 10005', email: 'prakash@bhosalegarments.example', address: 'Shiroli MIDC, Kolhapur, Maharashtra 416122', stateCode: '27', gstin: makeGstin('27AAJCB4567E1Z'), creditDays: 30, lang: 'hi', history: LATE.map((d) => d + 5) },
  { id: 'c6', aliases: ["राज फार्मा","राज","नेहा"], name: 'Raj Pharma Distributors', contact: 'Neha Rajput', phone: '+91 98000 10006', email: 'neha@rajpharma.example', address: 'Andheri East, Mumbai, Maharashtra 400093', stateCode: '27', gstin: makeGstin('27AABCR5678F1Z'), creditDays: 30, lang: 'en', history: ON_TIME },
  { id: 'c7', aliases: ["सनराइज","सनराइज रिटेल","इमरान"], name: 'Sunrise Retail', contact: 'Imran Sheikh', phone: '+91 98000 10007', email: 'imran@sunriseretail.example', address: 'Camp, Pune, Maharashtra 411001', stateCode: '27', gstin: null, creditDays: 15, lang: 'hi', history: [7, 9, 8, 6, 10, 8] },
  { id: 'c8', aliases: ["शिंदे","शिन्दे","शिंदें","शिंदे प्लास्टिक्स","विजय"], name: 'Shinde Plastics', contact: 'Vijay Shinde', phone: '+91 98000 10008', email: 'vijay@shindeplastics.example', address: 'Waluj MIDC, Chhatrapati Sambhajinagar, Maharashtra 431136', stateCode: '27', gstin: makeGstin('27AAHCS6789G1Z'), creditDays: 30, lang: 'en', history: VERY_LATE },
  { id: 'c9', aliases: ["कर्नाटक","कर्नाटका","रमेश"], name: 'Karnataka Spices Ltd', contact: 'Ramesh Gowda', phone: '+91 98000 10009', email: 'ramesh@kaspices.example', address: 'Peenya Industrial Area, Bengaluru, Karnataka 560058', stateCode: '29', gstin: makeGstin('29AAMCK7890H1Z'), creditDays: 45, lang: 'en', history: [9, 11, 10, 8, 12, 10] },
  { id: 'c10', aliases: ["जोशी","जोशी ब्रदर्स","सचिन"], name: 'Joshi Brothers Stationers', contact: 'Sachin Joshi', phone: '+91 98000 10010', email: 'sachin@joshibros.example', address: 'Laxmi Road, Pune, Maharashtra 411030', stateCode: '27', gstin: makeGstin('27AAAFJ8901J1Z'), creditDays: 30, lang: 'en', history: SLIGHT },
  { id: 'c11', aliases: ["मेहता","मेहता सेरामिक्स","कुणाल"], name: 'Mehta Ceramics', contact: 'Kunal Mehta', phone: '+91 98000 10011', email: 'kunal@mehtaceramics.example', address: 'Dharavi Road, Mumbai, Maharashtra 400017', stateCode: '27', gstin: makeGstin('27AACCM9012K1Z'), creditDays: 30, lang: 'en', history: ON_TIME },
  { id: 'c12', aliases: ["नागपुर","नागपूर","नागपुर ऑरेंज","दिनेश"], name: 'Nagpur Oranges Traders', contact: 'Dinesh Wankhede', phone: '+91 98000 10012', email: 'dinesh@nagpuroranges.example', address: 'Kalamna Market, Nagpur, Maharashtra 440018', stateCode: '27', gstin: makeGstin('27AADFN0123L1Z'), creditDays: 30, lang: 'hi', history: LATE },
]

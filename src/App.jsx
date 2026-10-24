import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Invoices from './pages/Invoices.jsx'
import InvoiceDetail from './pages/InvoiceDetail.jsx'
import NewInvoice from './pages/NewInvoice.jsx'
import Customers from './pages/Customers.jsx'
import FollowUps from './pages/FollowUps.jsx'
import PayPage from './pages/PayPage.jsx'
import Inbox from './pages/Inbox.jsx'
import Payments from './pages/Payments.jsx'
import Forecast from './pages/Forecast.jsx'
import Chase from './pages/Chase.jsx'
import Rescue from './pages/Rescue.jsx'
import Documents from './pages/Documents.jsx'
import Settings from './pages/Settings.jsx'
import LetterPage from './pages/LetterPage.jsx'
import EvidencePage from './pages/EvidencePage.jsx'
import InvoicePrint from './pages/InvoicePrint.jsx'

export default function App() {
  return (
    <Routes>
      {/* what the customer sees: no login, no app chrome */}
      <Route path="/pay/:token" element={<PayPage />} />
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="followups" element={<FollowUps />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="invoices/:id/print" element={<InvoicePrint />} />
        <Route path="new" element={<NewInvoice />} />
        <Route path="new/:id" element={<NewInvoice />} />
        <Route path="customers" element={<Customers />} />
        <Route path="payments" element={<Payments />} />
        <Route path="forecast" element={<Forecast />} />
        <Route path="chase" element={<Chase />} />
        <Route path="rescue" element={<Rescue />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="documents" element={<Documents />} />
        <Route path="documents/evidence/:id" element={<EvidencePage />} />
        <Route path="letter/:customerId" element={<LetterPage />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

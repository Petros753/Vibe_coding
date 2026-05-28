import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './api/client'
import { Layout } from './components/layout/Layout'
import { PhonePage } from './pages/auth/PhonePage'
import { OtpPage } from './pages/auth/OtpPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { TicketsPage } from './pages/tickets/TicketsPage'
import { ResidentsPage } from './pages/residents/ResidentsPage'
import { AnnouncementsPage } from './pages/announcements/AnnouncementsPage'
import { CamerasPage } from './pages/cameras/CamerasPage'
import { SettingsPage } from './pages/settings/SettingsPage'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PhonePage />} />
          <Route path="/login/otp" element={<OtpPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/residents" element={<ResidentsPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/cameras" element={<CamerasPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

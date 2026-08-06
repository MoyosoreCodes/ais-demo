import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { AuthProvider, useAuth } from './AuthContext'
import { DataProvider } from './DataContext'
import { RefsProvider } from './RefsContext'
import { ToastProvider } from './ToastContext'
import { OfflineProvider } from './OfflineContext'
import { RequireAuth, RequirePermission } from './Guard'

import { SignInScreen } from '../modules/auth/SignInScreen'
import { RegisterScreen } from '../modules/auth/RegisterScreen'
import { PasswordResetScreen } from '../modules/auth/PasswordResetScreen'
import { FarmerPortal } from '../modules/auth/FarmerPortal'

import { ClientRegistry } from '../modules/clients/ClientRegistry'
import { ClientProfile } from '../modules/clients/ClientProfile'
import { ClientRegistration } from '../modules/clients/ClientRegistration'

import { FarmRegistry } from '../modules/farms/FarmRegistry'
import { FarmRegistration } from '../modules/farms/FarmRegistration'
import { FarmProfile } from '../modules/farms/FarmProfile'

import { LoanPipeline } from '../modules/loans/LoanPipeline'
import { LoanDetail } from '../modules/loans/LoanDetail'
import { LoanApplication } from '../modules/loans/LoanApplication'

import { SampleRegistry } from '../modules/lab/SampleRegistry'
import { SampleDetail } from '../modules/lab/SampleDetail'
import { SampleRequest } from '../modules/lab/SampleRequest'

import { LivestockServices } from '../modules/livestock/LivestockServices'
import { VisitDetail } from '../modules/livestock/VisitDetail'

import { SurveillanceRegistry } from '../modules/surveillance/SurveillanceRegistry'
import { CaseDetail } from '../modules/surveillance/CaseDetail'
import { CaseReport } from '../modules/surveillance/CaseReport'

import { VendorRegistry } from '../modules/vendors/VendorRegistry'
import { VendorDetail } from '../modules/vendors/VendorDetail'

import { FieldOperations } from '../modules/field-ops/FieldOperations'
import { InspectionDetail } from '../modules/field-ops/InspectionDetail'

import { LandOverview } from '../modules/land/LandOverview'
import { LandApplicationDetail } from '../modules/land/LandApplicationDetail'
import { LeaseDetail } from '../modules/land/LeaseDetail'

import { Dashboard } from '../modules/dashboard/Dashboard'
import { NotificationCentre } from '../modules/notifications/NotificationCentre'
import { DocumentRepository } from '../modules/documents/DocumentRepository'

import { AdminScreen } from '../modules/admin/AdminScreen'
import { CoverageScreen } from '../modules/admin/CoverageScreen'

/** Sends each role to the landing screen its permissions actually allow. */
function RoleHome() {
  const { user, role } = useAuth()
  if (!user) return <Navigate to="/signin" replace />
  if (role === 'farmer') return <Navigate to="/portal" replace />
  // Every staff role holds dashboard.national; it is the natural landing screen
  // now that S12 exists (xii.1).
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <DataProvider>
      <RefsProvider>
        <AuthProvider>
          <OfflineProvider>
          <ToastProvider>
            {/* Hash routing keeps deep links working from `file://` and from a
                static host without server-side rewrite rules. On React Router 7
                the transition and splat-path behaviours we opted into under v6
                are the defaults, so no future flags are needed. */}
            <HashRouter>
              <Routes>
                {/* ------------------------------------------- public (S01) */}
                <Route path="/signin" element={<SignInScreen />} />
                <Route path="/register" element={<RegisterScreen />} />
                <Route path="/forgot-password" element={<PasswordResetScreen />} />

                {/* ---------------------------------------- authenticated */}
                <Route
                  element={
                    <RequireAuth>
                      <AppLayout />
                    </RequireAuth>
                  }
                >
                  <Route index element={<RoleHome />} />

                  {/* S01 — farmer self-service */}
                  <Route
                    path="/portal"
                    element={
                      <RequirePermission permissions={['portal.self']}>
                        <FarmerPortal />
                      </RequirePermission>
                    }
                  />

                  {/* S02 — client registry */}
                  <Route
                    path="/clients"
                    element={
                      <RequirePermission permissions={['clients.view']}>
                        <ClientRegistry />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/clients/new"
                    element={
                      <RequirePermission permissions={['clients.edit']}>
                        <ClientRegistration />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/clients/:id"
                    element={
                      <RequirePermission permissions={['clients.view']}>
                        <ClientProfile />
                      </RequirePermission>
                    }
                  />

                  {/* S03 — farm registration */}
                  <Route
                    path="/farms"
                    element={
                      <RequirePermission permissions={['farms.view']}>
                        <FarmRegistry />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/farms/new"
                    element={
                      <RequirePermission permissions={['farms.edit']}>
                        <FarmRegistration />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/farms/:id"
                    element={
                      <RequirePermission permissions={['farms.view']}>
                        <FarmProfile />
                      </RequirePermission>
                    }
                  />

                  {/* S04 — land management */}
                  <Route
                    path="/land"
                    element={
                      <RequirePermission permissions={['land.view']}>
                        <LandOverview />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/land/applications/:id"
                    element={
                      <RequirePermission permissions={['land.view']}>
                        <LandApplicationDetail />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/land/leases/:id"
                    element={
                      <RequirePermission permissions={['land.view']}>
                        <LeaseDetail />
                      </RequirePermission>
                    }
                  />

                  {/* S05 — loan management */}
                  <Route
                    path="/loans"
                    element={
                      <RequirePermission permissions={['loans.view']}>
                        <LoanPipeline />
                      </RequirePermission>
                    }
                  />
                  {/* Farmers reach the application form from their portal, so
                      the guard accepts either self-service or officer rights. */}
                  <Route
                    path="/loans/apply"
                    element={
                      <RequirePermission permissions={['portal.self', 'loans.view']}>
                        <LoanApplication />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/loans/:id"
                    element={
                      <RequirePermission permissions={['loans.view']}>
                        <LoanDetail />
                      </RequirePermission>
                    }
                  />

                  {/* S06 — sampling & laboratory */}
                  <Route
                    path="/lab"
                    element={
                      <RequirePermission permissions={['lab.view']}>
                        <SampleRegistry />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/lab/request"
                    element={
                      <RequirePermission permissions={['portal.self', 'lab.view']}>
                        <SampleRequest />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/lab/:id"
                    element={
                      <RequirePermission permissions={['lab.view']}>
                        <SampleDetail />
                      </RequirePermission>
                    }
                  />

                  {/* S07 — livestock services */}
                  <Route
                    path="/livestock"
                    element={
                      <RequirePermission permissions={['livestock.view']}>
                        <LivestockServices />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/livestock/:id"
                    element={
                      <RequirePermission permissions={['livestock.view']}>
                        <VisitDetail />
                      </RequirePermission>
                    }
                  />

                  {/* S08 — passive surveillance */}
                  <Route
                    path="/surveillance"
                    element={
                      <RequirePermission permissions={['surveillance.view']}>
                        <SurveillanceRegistry />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/surveillance/report"
                    element={
                      <RequirePermission permissions={['portal.self', 'surveillance.view']}>
                        <CaseReport />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/surveillance/:id"
                    element={
                      <RequirePermission permissions={['surveillance.view']}>
                        <CaseDetail />
                      </RequirePermission>
                    }
                  />

                  {/* S09 — vendors & market */}
                  <Route
                    path="/vendors"
                    element={
                      <RequirePermission permissions={['vendors.view']}>
                        <VendorRegistry />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/vendors/:id"
                    element={
                      <RequirePermission permissions={['vendors.view']}>
                        <VendorDetail />
                      </RequirePermission>
                    }
                  />

                  {/* S10 — field operations */}
                  <Route
                    path="/field-ops"
                    element={
                      <RequirePermission permissions={['fieldops.view']}>
                        <FieldOperations />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/field-ops/:id"
                    element={
                      <RequirePermission permissions={['fieldops.view']}>
                        <InspectionDetail />
                      </RequirePermission>
                    }
                  />

                  {/* S12 — dashboard & reporting */}
                  <Route
                    path="/dashboard"
                    element={
                      <RequirePermission permissions={['dashboard.national']}>
                        <Dashboard />
                      </RequirePermission>
                    }
                  />

                  {/* S13 — notifications & digitized documents */}
                  <Route
                    path="/notifications"
                    element={
                      <RequirePermission permissions={['notifications.manage', 'portal.self']}>
                        <NotificationCentre />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/documents"
                    element={
                      <RequirePermission permissions={['documents.view']}>
                        <DocumentRepository />
                      </RequirePermission>
                    }
                  />

                  {/* S11 — administration */}
                  <Route
                    path="/admin"
                    element={
                      <RequirePermission permissions={['admin.users', 'admin.audit', 'admin.workflows']}>
                        <AdminScreen />
                      </RequirePermission>
                    }
                  />

                  {/* Traceability coverage — supports the bid annex */}
                  <Route path="/coverage" element={<CoverageScreen />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </HashRouter>
          </ToastProvider>
          </OfflineProvider>
        </AuthProvider>
      </RefsProvider>
    </DataProvider>
  )
}

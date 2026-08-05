import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './app/auth';
import { RequireFarmer, RequireScreen, RequireStaff } from './app/Guard';
import { Layout } from './app/Layout';
import { RefsProvider } from './app/RefsContext';
import { ToastProvider } from './components/Toast';
import { landingPath } from './lib/rbac';
import { StoreProvider } from './lib/store';
import { Admin } from './modules/admin/Admin';
import { FarmerPortal } from './modules/auth/FarmerPortal';
import { Login } from './modules/auth/Login';
import { Register } from './modules/auth/Register';
import { ClientProfile } from './modules/clients/ClientProfile';
import { Clients } from './modules/clients/Clients';
import { Dashboard } from './modules/dashboard/Dashboard';
import { Documents } from './modules/documents/Documents';
import { Farms } from './modules/farms/Farms';
import { FieldOps } from './modules/field-ops/FieldOps';
import { Lab } from './modules/lab/Lab';
import { Land } from './modules/land/Land';
import { Livestock } from './modules/livestock/Livestock';
import { Loans } from './modules/loans/Loans';
import { Notifications } from './modules/notifications/Notifications';
import { Surveillance } from './modules/surveillance/Surveillance';
import { Vendors } from './modules/vendors/Vendors';

function Index() {
  const { user } = useAuth();
  return <Navigate to={user ? landingPath(user.role) : '/login'} replace />;
}

export default function App() {
  return (
    <StoreProvider>
      <AuthProvider>
        <RefsProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                  path="/portal"
                  element={
                    <RequireFarmer>
                      <FarmerPortal />
                    </RequireFarmer>
                  }
                />
                <Route
                  path="/app"
                  element={
                    <RequireStaff>
                      <Layout />
                    </RequireStaff>
                  }
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route
                    path="dashboard"
                    element={
                      <RequireScreen screen="dashboard">
                        <Dashboard />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="clients"
                    element={
                      <RequireScreen screen="clients">
                        <Clients />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="clients/:id"
                    element={
                      <RequireScreen screen="clients">
                        <ClientProfile />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="farms"
                    element={
                      <RequireScreen screen="farms">
                        <Farms />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="land"
                    element={
                      <RequireScreen screen="land">
                        <Land />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="loans"
                    element={
                      <RequireScreen screen="loans">
                        <Loans />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="lab"
                    element={
                      <RequireScreen screen="lab">
                        <Lab />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="livestock"
                    element={
                      <RequireScreen screen="livestock">
                        <Livestock />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="surveillance"
                    element={
                      <RequireScreen screen="surveillance">
                        <Surveillance />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="vendors"
                    element={
                      <RequireScreen screen="vendors">
                        <Vendors />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="field-ops"
                    element={
                      <RequireScreen screen="field-ops">
                        <FieldOps />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="notifications"
                    element={
                      <RequireScreen screen="notifications">
                        <Notifications />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="documents"
                    element={
                      <RequireScreen screen="documents">
                        <Documents />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="admin"
                    element={
                      <RequireScreen screen="admin">
                        <Admin />
                      </RequireScreen>
                    }
                  />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </RefsProvider>
      </AuthProvider>
    </StoreProvider>
  );
}

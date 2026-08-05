// Root: providers + routing. Public portal/auth routes, then the RBAC-guarded
// back-office under /app. Screens not yet built resolve to a Placeholder.
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './app/auth';
import { RequireFarmer, RequireScreen, RequireStaff } from './app/Guard';
import { Layout } from './app/Layout';
import { RefsProvider } from './app/RefsContext';
import { Placeholder } from './components/Placeholder';
import { ToastProvider } from './components/Toast';
import { landingPath, SCREENS } from './lib/rbac';
import { StoreProvider } from './lib/store';
import { Admin } from './modules/admin/Admin';
import { FarmerPortal } from './modules/auth/FarmerPortal';
import { Login } from './modules/auth/Login';
import { Register } from './modules/auth/Register';
import { ClientProfile } from './modules/clients/ClientProfile';
import { Clients } from './modules/clients/Clients';
import { Dashboard } from './modules/dashboard/Dashboard';
import { Farms } from './modules/farms/Farms';

const screen = (key: string) => SCREENS.find((s) => s.key === key)!;

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
                        <Placeholder screen={screen('land')} wave="Wave B" />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="loans"
                    element={
                      <RequireScreen screen="loans">
                        <Placeholder screen={screen('loans')} wave="Wave B" />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="lab"
                    element={
                      <RequireScreen screen="lab">
                        <Placeholder screen={screen('lab')} wave="Wave B" />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="livestock"
                    element={
                      <RequireScreen screen="livestock">
                        <Placeholder screen={screen('livestock')} wave="Wave C" />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="surveillance"
                    element={
                      <RequireScreen screen="surveillance">
                        <Placeholder screen={screen('surveillance')} wave="Wave C" />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="vendors"
                    element={
                      <RequireScreen screen="vendors">
                        <Placeholder screen={screen('vendors')} wave="Wave C" />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="field-ops"
                    element={
                      <RequireScreen screen="field-ops">
                        <Placeholder screen={screen('field-ops')} wave="Wave C" />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="notifications"
                    element={
                      <RequireScreen screen="notifications">
                        <Placeholder screen={screen('notifications')} wave="Wave D" />
                      </RequireScreen>
                    }
                  />
                  <Route
                    path="documents"
                    element={
                      <RequireScreen screen="documents">
                        <Placeholder screen={screen('documents')} wave="Wave D" />
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

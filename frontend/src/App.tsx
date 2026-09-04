import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StudentAuthProvider, useStudentAuth } from './context/StudentAuthContext';
import { Loading } from './components/Loading';

// Pages — carregadas por rota. Cada página traz sua própria dependência pesada
// (MUI no login, recharts no dashboard, html2canvas nos alunos) e nenhuma
// precisa estar no bundle inicial.
const Landing = lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Classes = lazy(() => import('./pages/Classes').then(m => ({ default: m.Classes })));
const Agenda = lazy(() => import('./pages/Agenda').then(m => ({ default: m.Agenda })));
const ClassDetails = lazy(() => import('./pages/ClassDetails').then(m => ({ default: m.ClassDetails })));
const Students = lazy(() => import('./pages/Students').then(m => ({ default: m.Students })));
const Payments = lazy(() => import('./pages/Payments').then(m => ({ default: m.Payments })));
const Admin = lazy(() => import('./pages/Admin'));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
const StudentLogin = lazy(() => import('./pages/StudentLogin').then(m => ({ default: m.StudentLogin })));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard').then(m => ({ default: m.StudentDashboard })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const TrialExpired = lazy(() => import('./pages/TrialExpired').then(m => ({ default: m.TrialExpired })));
const Pricing = lazy(() => import('./pages/Pricing'));
const Register = lazy(() => import('./pages/Register'));
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess').then(m => ({ default: m.CheckoutSuccess })));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));

// Layouts
import { Layout } from './components/Layout';
import { StudentLayout } from './components/StudentLayout';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading, isTrialExpired } = useAuth();
  if (isLoading) return <Loading variant="fullscreen" text="Carregando..." />;
  if (isTrialExpired) return <Navigate to="/trial-expired" />;
  if (!user) return <Navigate to="/login" />;
  return children;
};

const ProtectedStudentRoute = ({ children }: { children: ReactNode }) => {
  const { student, isLoading } = useStudentAuth();
  if (isLoading) return <Loading variant="fullscreen" text="Carregando portal..." />;
  if (!student) return <Navigate to="/portal/login" />;
  return children;
};

import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <StudentAuthProvider>
            <AppRoutes />
          </StudentAuthProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<Loading variant="fullscreen" text="Carregando..." />}>
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/callback" element={<OAuthCallback />} />
      <Route path="/trial-expired" element={<TrialExpired />} />
      <Route path="/checkout/success" element={<CheckoutSuccess />} />

      {/* Student Portal Routes */}
      <Route path="/portal/login" element={<StudentLogin />} />
      <Route path="/portal" element={
        <ProtectedStudentRoute>
          <StudentLayout />
        </ProtectedStudentRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboard />} />
      </Route>

      {/* Protected Admin Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="classes" element={<Classes />} />
        <Route path="class/:id" element={<ClassDetails />} />
        <Route path="students" element={<Students />} />
        <Route path="payments" element={<Payments />} />
        <Route path="admin" element={<Admin />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default App;

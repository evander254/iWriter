import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { AuthLayout } from "./layouts/AuthLayout";
import { AdminLayout } from "./layouts/AdminLayout";
import { WriterLayout } from "./layouts/WriterLayout";
import { RequireRole, RoleHomeRedirect } from "./components/common/ProtectedRoute";
import { NotFoundPage } from "./pages/NotFound";

/* Auth */
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";

/* Admin */
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { AdminAssignmentsPage } from "./pages/admin/AdminAssignmentsPage";
import { AdminAssignmentFormPage } from "./pages/admin/AdminAssignmentFormPage";
import { AdminAssignmentDetailPage } from "./pages/admin/AdminAssignmentDetailPage";
import { AdminClaimsPage } from "./pages/admin/AdminClaimsPage";
import { AdminSubmissionsPage } from "./pages/admin/AdminSubmissionsPage";
import { AdminSubmissionReviewPage } from "./pages/admin/AdminSubmissionReviewPage";
import { AdminRevisionsPage } from "./pages/admin/AdminRevisionsPage";
import { AdminWritersPage } from "./pages/admin/AdminWritersPage";
import { AdminWriterDetailPage } from "./pages/admin/AdminWriterDetailPage";
import { AdminSubjectsPage } from "./pages/admin/AdminSubjectsPage";
import { AdminCategoriesPage } from "./pages/admin/AdminCategoriesPage";
import { AdminFinancePage } from "./pages/admin/AdminFinancePage";
import { AdminWithdrawalsPage } from "./pages/admin/AdminWithdrawalsPage";
import { AdminNotificationsPage } from "./pages/admin/AdminNotificationsPage";
import { AdminAnnouncementsPage } from "./pages/admin/AdminAnnouncementsPage";
import { AdminActivityPage } from "./pages/admin/AdminActivityPage";
import { AdminProfilePage } from "./pages/admin/AdminProfilePage";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage";

/* Writer */
import { WriterOverviewPage } from "./pages/writer/WriterOverviewPage";
import { WriterBrowsePage } from "./pages/writer/WriterBrowsePage";
import { WriterAssignmentDetailPage } from "./pages/writer/WriterAssignmentDetailPage";
import { WriterMyAssignmentsPage } from "./pages/writer/WriterMyAssignmentsPage";
import { WriterWorkspacePage } from "./pages/writer/WriterWorkspacePage";
import { WriterSubmissionsPage } from "./pages/writer/WriterSubmissionsPage";
import { WriterRevisionsPage } from "./pages/writer/WriterRevisionsPage";
import { WriterWalletPage } from "./pages/writer/WriterWalletPage";
import { WriterTransactionsPage } from "./pages/writer/WriterTransactionsPage";
import { WriterNotificationsPage } from "./pages/writer/WriterNotificationsPage";
import { WriterAnnouncementsPage } from "./pages/writer/WriterAnnouncementsPage";
import { WriterProfilePage } from "./pages/writer/WriterProfilePage";
import { WriterSettingsPage } from "./pages/writer/WriterSettingsPage";

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <Routes>
            <Route path="/" element={<RoleHomeRedirect />} />
            <Route path="/home" element={<Navigate to="/" replace />} />

            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>

            {/* ---------------- Admin portal ---------------- */}
            <Route element={<RequireRole role="admin" />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverviewPage />} />
                <Route path="assignments" element={<AdminAssignmentsPage />} />
                <Route path="assignments/new" element={<AdminAssignmentFormPage />} />
                <Route path="assignments/:id" element={<AdminAssignmentDetailPage />} />
                <Route path="assignments/:id/edit" element={<AdminAssignmentFormPage />} />
                <Route path="claims" element={<AdminClaimsPage />} />
                <Route path="submissions" element={<AdminSubmissionsPage />} />
                <Route path="submissions/:id" element={<AdminSubmissionReviewPage />} />
                <Route path="revisions" element={<AdminRevisionsPage />} />
                <Route path="writers" element={<AdminWritersPage />} />
                <Route path="writers/:id" element={<AdminWriterDetailPage />} />
                <Route path="subjects" element={<AdminSubjectsPage />} />
                <Route path="categories" element={<AdminCategoriesPage />} />
                <Route path="finance" element={<AdminFinancePage />} />
                <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
                <Route path="notifications" element={<AdminNotificationsPage />} />
                <Route path="announcements" element={<AdminAnnouncementsPage />} />
                <Route path="activity" element={<AdminActivityPage />} />
                <Route path="profile" element={<AdminProfilePage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
            </Route>

            {/* ---------------- Writer portal ---------------- */}
            <Route element={<RequireRole role="writer" />}>
              <Route path="/writer" element={<WriterLayout />}>
                <Route index element={<WriterOverviewPage />} />
                <Route path="assignments" element={<WriterBrowsePage />} />
                <Route path="assignments/:id" element={<WriterAssignmentDetailPage />} />
                <Route path="my-assignments" element={<WriterMyAssignmentsPage />} />
                <Route path="my-assignments/:claimId" element={<WriterWorkspacePage />} />
                <Route path="submissions" element={<WriterSubmissionsPage />} />
                <Route path="revisions" element={<WriterRevisionsPage />} />
                <Route path="wallet" element={<WriterWalletPage />} />
                <Route path="transactions" element={<WriterTransactionsPage />} />
                <Route path="notifications" element={<WriterNotificationsPage />} />
                <Route path="announcements" element={<WriterAnnouncementsPage />} />
                <Route path="profile" element={<WriterProfilePage />} />
                <Route path="settings" element={<WriterSettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

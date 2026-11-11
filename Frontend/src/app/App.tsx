// Function map (line numbers include this header):
// 1. App - line 20: Defines the application routes.
//
import { Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ProtectedRoute } from "../components/layout/ProtectedRoute";
import { PetDetailPage } from "../pages/PetDetailPage";
import { PetsPage } from "../pages/PetsPage";
import { SignInPage } from "../pages/SignInPage";
import { MedicalRecordsPage } from "../pages/MedicalRecordsPage";
import { VaccinationsPage } from "../pages/VaccinationsPage";
import { AppointmentsPage } from "../pages/AppointmentsPage";
import { OwnerPortalPage } from "../pages/OwnerPortalPage";
import { ReportsPage } from "../pages/ReportsPage";
import { RoleRoute } from "../components/layout/RoleRoute";
import { RoleFallback } from "../components/layout/RoleFallback";
import { OverviewLanding } from "../components/layout/OverviewLanding";
import { AdministrationPage } from "../pages/AdministrationPage";

export function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route element={<RoleRoute allowed={["staff", "vet", "owner"]} />}>
            <Route index element={<OverviewLanding />} />
          </Route>
          <Route element={<RoleRoute allowed={["staff", "vet"]} />}>
            <Route path="pets" element={<PetsPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>
          <Route element={<RoleRoute allowed={["staff", "vet"]} />}>
            <Route path="administration" element={<AdministrationPage />} />
          </Route>
          <Route element={<RoleRoute allowed={["staff", "vet", "owner"]} />}>
            <Route path="pets/:id" element={<PetDetailPage />} />
            <Route path="medical-records" element={<MedicalRecordsPage />} />
            <Route path="vaccinations" element={<VaccinationsPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route element={<RoleRoute allowed={["owner"]} />}>
              <Route path="owner-portal" element={<OwnerPortalPage />} />
            </Route>
          </Route>
          <Route path="*" element={<RoleFallback />} />
        </Route>
      </Route>
    </Routes>
  );
}

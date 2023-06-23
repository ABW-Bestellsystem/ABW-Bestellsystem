import './App.css';
import { Route, Routes } from 'react-router-dom';
import { ReactNotifications } from 'react-notifications-component';
import 'react-notifications-component/dist/theme.css';
import 'animate.css/animate.min.css';

import LoginPage from './Pages/loginPage/loginPage';
import DashboardPage from './Pages/dashboardPages/dashboardPage';
import CartPage from './Pages/cardPage/cartPage';
import AdminPage from './Pages/adminPage/adminPage';
import ProfilePage from './Pages/profilePage/profilePage';
import { Auth, AuthProvider } from './authentication/authHandler';
import PrivacyPage from './Pages/privacyInfoPage/privacyInfoPage';
import EditorDashboardPage from './Pages/editor/dashboardPage/editorDashboardPage';
import CustomPage from './Pages/editor/customPage/customPage';
import Statistics from './Pages/editor/statisticsPage/Statistics';
import BackupPage from './Pages/editor/backupPage/backupPage';

function App() {  
  return (
    <AuthProvider>
      <ReactNotifications />
      <Routes>
        <Route index element={<LoginPage />} />
        <Route path="privacyinfo" element={<PrivacyPage />} />
        <Route
          path="home/:siteID"
          element={
            <Auth>
              <DashboardPage />
            </Auth>
          }
        />
        <Route
          path="home"
          element={
            <Auth>
              <DashboardPage />
            </Auth>
          }
        />
        <Route
          path="profile"
          element={
            <Auth>
              <ProfilePage />
            </Auth>
          }
        />
        <Route
          path="cart"
          element={
            <Auth>
              <CartPage />
            </Auth>
          }
        />
        <Route
          path="login"
          element={
            <Auth>
              <LoginPage />
            </Auth>
          }
        />
        <Route
          path="admin"
          element={
            <Auth>
              <AdminPage />
            </Auth>
          }
        />
        <Route
          path="editor"
          element={
            <Auth>
              <EditorDashboardPage />
            </Auth>
          }
        />
        <Route
          path="editor/statistics"
          element={
            <Auth>
              <Statistics />
            </Auth>
          }
        />
        <Route
          path="editor/backup"
          element={
            <Auth>
              <BackupPage />
            </Auth>
          }
        />
        <Route
          path="edit/:siteID"
          element={
            <Auth>
              <CustomPage />
            </Auth>
          }
        />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;

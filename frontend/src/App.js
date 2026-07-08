import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
import Dashboard from "@/pages/Dashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import Courses from "@/pages/Courses";
import VideoAnalysis from "@/pages/VideoAnalysis";
import SpotRecommender from "@/pages/SpotRecommender";
import Coach from "@/pages/Coach";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import PaymentSuccess from "@/pages/PaymentSuccess";
import WeekendSpots from "@/pages/WeekendSpots";
import SpotCatalog from "@/pages/SpotCatalog";
import { MentionsLegales, CGU, Confidentialite, Cookies } from "@/pages/Legal";
import NotFound from "@/pages/NotFound";
import { Toaster } from "sonner";
import PageSeo from "@/components/PageSeo";
import { BackendBanner } from "@/components/BackendBanner";
import EmailVerificationBanner from "@/components/EmailVerificationBanner";

function AppRouter() {
  const location = useLocation();
  const hideChrome = location.pathname.startsWith("/payment-success") || location.pathname === "/login" || location.pathname === "/reset-password" || location.pathname === "/verify-email";
  return (
    <>
      {!hideChrome && <Navbar />}
      {!hideChrome && <EmailVerificationBanner />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/video-analysis" element={<VideoAnalysis />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/spot-recommender" element={<SpotRecommender />} />
        <Route path="/meilleurs-spots-kitesurf-weekend" element={<WeekendSpots />} />
        <Route path="/spots-kitesurf" element={<SpotCatalog />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/mentions-legales" element={<MentionsLegales />} />
        <Route path="/cgu" element={<CGU />} />
        <Route path="/confidentialite" element={<Confidentialite />} />
        <Route path="/cookies" element={<Cookies />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!hideChrome && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <PageSeo />
          <AppRouter />
          <BackendBanner />
          <Toaster theme="dark" position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
import Dashboard from "@/pages/Dashboard";
import Courses from "@/pages/Courses";
import VideoAnalysis from "@/pages/VideoAnalysis";
import SpotRecommender from "@/pages/SpotRecommender";
import AuthCallback from "@/pages/AuthCallback";
import PaymentSuccess from "@/pages/PaymentSuccess";
import { Toaster } from "sonner";

function AppRouter() {
  const location = useLocation();
  // Detect OAuth callback in URL fragment (synchronously) to avoid race conditions
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  const hideChrome = location.pathname.startsWith("/auth/callback") || location.pathname.startsWith("/payment-success");
  return (
    <>
      {!hideChrome && <Navbar />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/video-analysis" element={<VideoAnalysis />} />
        <Route path="/spot-recommender" element={<SpotRecommender />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
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
          <AppRouter />
          <Toaster theme="dark" position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

import { LOGO_URL } from "@/lib/api";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer data-testid="footer" className="border-t border-[#262626] bg-black mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="RIDEMIND" className="h-10 object-contain" />
            <div>
              <div className="font-display text-2xl">RIDE<span className="text-[#1E6BFF]">MIND</span></div>
              <div className="text-[10px] tracking-[0.25em] text-gray-400 uppercase">Progress your ride</div>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-4 max-w-md">
            Plateforme de coaching personnel pour rideurs de kitesurf, wakeboard, foil et surf. Analyse IA, cours en ligne et recommandations de spots.
          </p>
        </div>
        <div>
          <div className="font-display text-sm tracking-wider mb-3 text-gray-300">PLATEFORME</div>
          <ul className="space-y-2 text-sm text-gray-400">
            <li><Link to="/pricing" className="hover:text-[#1E6BFF]">Abonnements</Link></li>
            <li><Link to="/courses" className="hover:text-[#1E6BFF]">Cours</Link></li>
            <li><Link to="/video-analysis" className="hover:text-[#1E6BFF]">Analyse vidéo</Link></li>
            <li><Link to="/spot-recommender" className="hover:text-[#1E6BFF]">Spot Finder</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-display text-sm tracking-wider mb-3 text-gray-300">LÉGAL</div>
          <ul className="space-y-2 text-sm text-gray-400">
            <li><Link to="/mentions-legales" data-testid="footer-legal-mentions" className="hover:text-[#1E6BFF]">Mentions légales</Link></li>
            <li><Link to="/cgu" data-testid="footer-legal-cgu" className="hover:text-[#1E6BFF]">CGU</Link></li>
            <li><Link to="/confidentialite" data-testid="footer-legal-privacy" className="hover:text-[#1E6BFF]">Confidentialité</Link></li>
            <li><Link to="/cookies" data-testid="footer-legal-cookies" className="hover:text-[#1E6BFF]">Cookies</Link></li>
            <li className="pt-2"><a href="mailto:GetRideMind@gmail.com" className="text-gray-400 hover:text-[#1E6BFF]">GetRideMind@gmail.com</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#262626] py-5 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} RIDEMIND — Progress Your Ride.
      </div>
    </footer>
  );
}

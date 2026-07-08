import { LOGO_URL } from "@/lib/api";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer data-testid="footer" className="border-t border-[#262626] bg-black mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Ride’Up" className="h-12 object-contain" />
            <div>
              <div className="text-[10px] tracking-[0.25em] text-gray-400 uppercase">Progress your ride</div>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-4 max-w-md">
            Coaching kitesurf, wakeboard, foil et surf en ligne. Analyse vidéo de figures, coach personnel,
            cours structurés et Spot Finder selon le vent — pour progresser session après session.
          </p>
        </div>
        <div>
          <div className="font-display text-sm tracking-wider mb-3 text-gray-300">PLATEFORME</div>
          <ul className="space-y-2 text-sm text-gray-400">
            <li><Link to="/pricing" className="hover:text-[#9AB8FF]">Abonnements</Link></li>
            <li><Link to="/courses" className="hover:text-[#9AB8FF]">Cours</Link></li>
            <li><Link to="/video-analysis" className="hover:text-[#9AB8FF]">Analyse vidéo kitesurf</Link></li>
            <li><Link to="/coach" className="hover:text-[#9AB8FF]">Coach kitesurf</Link></li>
            <li><Link to="/spots-kitesurf" className="hover:text-[#9AB8FF]">Catalogue spots (6000+)</Link></li>
            <li><Link to="/meilleurs-spots-kitesurf-weekend" className="hover:text-[#9AB8FF]">Spots week-end</Link></li>
            <li><Link to="/spot-recommender" className="hover:text-[#9AB8FF]">Spot Finder</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-display text-sm tracking-wider mb-3 text-gray-300">LÉGAL</div>
          <ul className="space-y-2 text-sm text-gray-400">
            <li><Link to="/mentions-legales" data-testid="footer-legal-mentions" className="hover:text-[#9AB8FF]">Mentions légales</Link></li>
            <li><Link to="/cgu" data-testid="footer-legal-cgu" className="hover:text-[#9AB8FF]">CGU</Link></li>
            <li><Link to="/confidentialite" data-testid="footer-legal-privacy" className="hover:text-[#9AB8FF]">Confidentialité</Link></li>
            <li><Link to="/cookies" data-testid="footer-legal-cookies" className="hover:text-[#9AB8FF]">Cookies</Link></li>
            <li className="pt-2"><a href="mailto:GetRideMind@gmail.com" className="text-gray-400 hover:text-[#9AB8FF]">GetRideMind@gmail.com</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#262626] py-5 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} RIDE’UP — Progress Your Ride.
      </div>
    </footer>
  );
}

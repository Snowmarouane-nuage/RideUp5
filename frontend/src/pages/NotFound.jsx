import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6 flex items-center justify-center">
      <div className="text-center max-w-lg">
        <div className="text-[#9AB8FF] font-display text-xs tracking-[0.3em] mb-3">404</div>
        <h1 className="font-display text-4xl md:text-6xl mb-4">PAGE INTROUVABLE</h1>
        <p className="text-gray-400 mb-8">Cette page n&apos;existe pas ou a été déplacée.</p>
        <Link to="/" className="inline-block bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white px-8 py-4 font-display tracking-wider">
          RETOUR À L&apos;ACCUEIL
        </Link>
      </div>
    </div>
  );
}

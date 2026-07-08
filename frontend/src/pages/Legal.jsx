import { Link } from "react-router-dom";

export function LegalLayout({ title, lastUpdate = "Février 2026", children }) {
  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-xs font-display tracking-[0.3em] text-[#9AB8FF] hover:underline">← RETOUR ACCUEIL</Link>
        <h1 className="font-display text-4xl md:text-5xl mt-4 mb-2">{title}</h1>
        <div className="text-xs text-gray-500 mb-10">Dernière mise à jour : {lastUpdate}</div>
        <div className="prose prose-invert prose-sm max-w-none space-y-4 text-gray-300 leading-relaxed">
          {children}
        </div>
        <div className="mt-12 p-4 border border-[#9AB8FF]/40 bg-[#9AB8FF]/5 text-sm text-gray-400">
          ⚠️ <strong>Document modèle</strong> — ce texte est un modèle de base. L'éditeur du site doit le compléter avec ses informations légales (raison sociale, SIRET, RCS, adresse, hébergeur, DPO, etc.) avant ouverture au public.
        </div>
      </div>
    </div>
  );
}

export function MentionsLegales() {
  return (
    <LegalLayout title="MENTIONS LÉGALES">
      <h2 className="font-display text-2xl text-white">1. Éditeur du site</h2>
      <p>RIDE’UP<br/>[Raison sociale à compléter]<br/>[Adresse postale à compléter]<br/>Email : GetRideMind@gmail.com<br/>SIRET : [à compléter]<br/>RCS : [à compléter]<br/>N° TVA intracommunautaire : [à compléter]</p>

      <h2 className="font-display text-2xl text-white mt-8">2. Directeur de publication</h2>
      <p>[Nom du responsable légal à compléter]</p>

      <h2 className="font-display text-2xl text-white mt-8">3. Hébergement</h2>
      <p>
        Le site RIDE&apos;UP est hébergé par l&apos;éditeur ou son prestataire d&apos;hébergement
        ([nom et adresse de l&apos;hébergeur à compléter — ex. Vercel, Railway, OVH…]).
      </p>

      <h2 className="font-display text-2xl text-white mt-8">4. Propriété intellectuelle</h2>
      <p>L'ensemble des contenus présents sur le site RIDE’UP (textes, images, logos, vidéos pédagogiques, design, analyses IA) est protégé par le droit d'auteur et reste la propriété exclusive de l'éditeur ou de ses partenaires. Toute reproduction sans autorisation préalable est interdite.</p>

      <h2 className="font-display text-2xl text-white mt-8">5. Contact</h2>
      <p>Pour toute question : GetRideMind@gmail.com</p>
    </LegalLayout>
  );
}

export function CGU() {
  return (
    <LegalLayout title="CONDITIONS GÉNÉRALES">
      <h2 className="font-display text-2xl text-white">1. Objet</h2>
      <p>RIDE’UP est une plateforme de coaching personnel en ligne dédiée aux sports de glisse (kitesurf, wakeboard, foil, surf). Le service inclut : analyse vidéo par IA, cours en ligne, recommandation de spots (offre Premium).</p>

      <h2 className="font-display text-2xl text-white mt-8">2. Abonnements</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li><strong>Standard</strong> : 9,99 € TTC / mois — analyse vidéo IA + accès aux cours</li>
        <li><strong>Premium</strong> : 15,99 € TTC / mois — Standard + Spot Finder IA</li>
      </ul>
      <p>Le paiement est traité par Stripe. Aucune donnée bancaire n'est stockée sur les serveurs RIDE’UP.</p>

      <h2 className="font-display text-2xl text-white mt-8">3. Résiliation</h2>
      <p>L'abonnement est sans engagement. Tu peux le résilier à tout moment depuis ton espace client. L'accès reste actif jusqu'à la fin de la période payée.</p>

      <h2 className="font-display text-2xl text-white mt-8">4. Limitation de responsabilité</h2>
      <p>Les sports de glisse comportent des risques. Les conseils délivrés (IA ou cours) sont à titre informatif et pédagogique. RIDE’UP ne saurait être tenu responsable d'un accident ou d'une blessure survenue lors d'une session. Le pratiquant reste seul responsable de la sécurité de sa pratique, du respect des règles locales et de l'évaluation des conditions sur place.</p>

      <h2 className="font-display text-2xl text-white mt-8">5. Droit applicable</h2>
      <p>Les présentes CGU sont régies par le droit français. Tout litige relèvera de la compétence des tribunaux français.</p>
    </LegalLayout>
  );
}

export function Confidentialite() {
  return (
    <LegalLayout title="POLITIQUE DE CONFIDENTIALITÉ">
      <h2 className="font-display text-2xl text-white">1. Données collectées</h2>
      <p>Lorsque tu utilises RIDE’UP, nous collectons :</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Identifiants de compte (nom, email) créés sur RIDE&apos;UP</li>
        <li>Vidéos téléversées pour l'analyse IA</li>
        <li>Données techniques saisies (poids, matériel, niveau) pour le Spot Finder</li>
        <li>Historique de tes analyses et paiements</li>
      </ul>

      <h2 className="font-display text-2xl text-white mt-8">2. Utilisation</h2>
      <p>Tes données sont utilisées uniquement pour fournir le service de coaching. Aucune vente à des tiers. Les vidéos téléversées ne servent qu'à générer ton retour personnalisé.</p>

      <h2 className="font-display text-2xl text-white mt-8">3. Sous-traitants</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li><strong>Resend</strong> (ou prestataire email) : confirmation de compte et réinitialisation mot de passe</li>
        <li><strong>Stripe</strong> : paiements</li>
        <li><strong>OpenAI / Anthropic</strong> : analyse vidéo et coaching personnalisé</li>
        <li><strong>Prestataires météo</strong> : prévisions vent pour Spot Finder et classement week-end</li>
      </ul>

      <h2 className="font-display text-2xl text-white mt-8">4. Tes droits (RGPD)</h2>
      <p>Tu peux à tout moment demander l'accès, la rectification ou la suppression de tes données en écrivant à GetRideMind@gmail.com. Tu peux également demander la portabilité de tes données.</p>

      <h2 className="font-display text-2xl text-white mt-8">5. Conservation</h2>
      <p>Tes données sont conservées tant que ton compte est actif, puis supprimées dans les 90 jours suivant sa fermeture (sauf obligations légales — factures conservées 10 ans).</p>
    </LegalLayout>
  );
}

export function Cookies() {
  return (
    <LegalLayout title="POLITIQUE COOKIES">
      <h2 className="font-display text-2xl text-white">1. Qu'est-ce qu'un cookie ?</h2>
      <p>Un cookie est un petit fichier stocké sur ton appareil quand tu visites un site. RIDE’UP utilise des cookies uniquement essentiels au fonctionnement du service.</p>

      <h2 className="font-display text-2xl text-white mt-8">2. Cookies utilisés</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li><strong>session_token</strong> (httpOnly, sécurisé) — Garde ta session connectée. Durée : 30 jours.</li>
        <li><strong>Cookies Stripe</strong> — Indispensables au tunnel de paiement.</li>
      </ul>
      <p>Nous n'utilisons <strong>aucun cookie publicitaire</strong> ni de tracking marketing tiers.</p>

      <h2 className="font-display text-2xl text-white mt-8">3. Gestion</h2>
      <p>Tu peux supprimer les cookies à tout moment depuis les paramètres de ton navigateur. Note que la déconnexion automatique surviendra ensuite.</p>
    </LegalLayout>
  );
}

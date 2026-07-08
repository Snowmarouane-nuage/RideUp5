import { useEffect } from "react";

const SITE_NAME = "RIDE'UP";
const SITE_URL = process.env.REACT_APP_SITE_URL || "https://rideup.app";
const DEFAULT_OG_IMAGE = `${SITE_URL}/logo.png`;

const KEYWORDS =
  "kitesurf, coaching kitesurf, analyse vidéo kitesurf, wakeboard, foil, surf, coach glisse, progression kite, spots kitesurf, météo vent";

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertJsonLd(id, data) {
  let el = document.getElementById(id);
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export const ROUTE_SEO = {
  "/": {
    title: "RIDE'UP — Coaching kitesurf & analyse vidéo pour progresser",
    description:
      "Progresse en kitesurf, wakeboard, foil et surf avec RIDE'UP : analyse vidéo par coach expert, roadmap personnalisée, cours en ligne et Spot Finder selon le vent.",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          name: SITE_NAME,
          url: SITE_URL,
          description: "Plateforme de coaching pour sports de glisse : kitesurf, wakeboard, foil et surf.",
          email: "GetRideMind@gmail.com",
        },
        {
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL,
          inLanguage: "fr-FR",
          description:
            "Coaching kitesurf et sports de glisse : analyse vidéo, coach personnel et recommandation de spots.",
        },
        {
          "@type": "SoftwareApplication",
          name: SITE_NAME,
          applicationCategory: "SportsApplication",
          operatingSystem: "Web",
          offers: {
            "@type": "Offer",
            price: "9.99",
            priceCurrency: "EUR",
          },
        },
      ],
    },
  },
  "/pricing": {
    title: "Abonnements coaching kitesurf — Standard & Premium | RIDE'UP",
    description:
      "Abonne-toi à RIDE'UP dès 9,99 €/mois : analyse vidéo illimitée, coach IA kitesurf et Spot Finder Premium. Sans engagement.",
  },
  "/video-analysis": {
    title: "Analyse vidéo kitesurf & glisse — Coach expert | RIDE'UP",
    description:
      "Envoie un clip de 20 secondes : un coach expert kitesurf, wakeboard, foil ou surf analyse ta figure et te donne corrections et drills.",
  },
  "/coach": {
    title: "Coach personnel kitesurf — Roadmap & chat | RIDE'UP",
    description:
      "Coach IA dédié pour progresser trick par trick en kitesurf : roadmap personnalisée, suivi de figures et chat coaching.",
  },
  "/courses": {
    title: "Cours kitesurf en ligne — Débutant à avancé | RIDE'UP",
    description:
      "Bibliothèque de cours kitesurf structurés pour débutants et riders avancés. Modules vidéo pour maîtriser les bases et le freestyle.",
  },
  "/spot-recommender": {
    title: "Spot Finder kitesurf — Meilleur spot selon le vent | RIDE'UP",
    description:
      "Trouve le meilleur spot de kitesurf selon ton niveau, ton matériel, le vent en temps réel et ta position. Fonction Premium RIDE'UP.",
  },
  "/meilleurs-spots-kitesurf-weekend": {
    title: "Meilleurs spots kitesurf ce week-end — France & monde | RIDE'UP",
    description:
      "Classement week-end des spots kitesurf par pays : vent rideable samedi-dimanche, conditions mises à jour régulièrement.",
  },
  "/spots-kitesurf": {
    title: "Catalogue spots kitesurf monde — 6000+ spots | RIDE'UP",
    description:
      "Recherche parmi plus de 6000 spots de kitesurf dans 164 pays. Filtre par pays, niveau et danger.",
  },
  "/verify-email": {
    title: "Confirmation email — RIDE'UP",
    description: "Confirme ton adresse email pour activer ton compte RIDE'UP.",
    noindex: true,
  },
  "/reset-password": {
    title: "Nouveau mot de passe — RIDE'UP",
    description: "Choisis un nouveau mot de passe pour ton compte RIDE'UP.",
    noindex: true,
  },
  "/login": {
    title: "Connexion — RIDE'UP",
    description: "Connecte-toi ou crée ton compte RIDE'UP pour accéder au coaching kitesurf et à l'analyse vidéo.",
    noindex: true,
  },
  "/dashboard": {
    title: "Mon dashboard — RIDE'UP",
    description: "Suis ta progression kitesurf : analyses, tricks validés et activité.",
    noindex: true,
  },
  "/admin": {
    title: "Administration — RIDE'UP",
    noindex: true,
  },
  "/payment-success": {
    title: "Paiement confirmé — RIDE'UP",
    noindex: true,
  },
  "/mentions-legales": {
    title: "Mentions légales — RIDE'UP",
    description: "Mentions légales du site RIDE'UP, plateforme de coaching kitesurf et sports de glisse.",
  },
  "/cgu": {
    title: "Conditions générales d'utilisation — RIDE'UP",
    description: "CGU de RIDE'UP : conditions d'utilisation de la plateforme de coaching kitesurf.",
  },
  "/confidentialite": {
    title: "Politique de confidentialité — RIDE'UP",
    description: "Politique de confidentialité et protection des données personnelles sur RIDE'UP.",
  },
  "/cookies": {
    title: "Politique cookies — RIDE'UP",
    description: "Informations sur les cookies utilisés par RIDE'UP.",
  },
};

const DEFAULT_SEO = ROUTE_SEO["/"];

export function usePageSeo(pathname) {
  useEffect(() => {
    const seo = ROUTE_SEO[pathname] || DEFAULT_SEO;
    const title = seo.title || DEFAULT_SEO.title;
    const description = seo.description || DEFAULT_SEO.description;
    const canonical = `${SITE_URL}${pathname === "/" ? "" : pathname}`;

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "keywords", KEYWORDS);
    upsertMeta("name", "robots", seo.noindex ? "noindex, nofollow" : "index, follow");

    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:locale", "fr_FR");
    upsertMeta("property", "og:image", DEFAULT_OG_IMAGE);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);

    upsertLink("canonical", canonical);
    upsertJsonLd("rideup-jsonld", seo.jsonLd || null);
  }, [pathname]);
}

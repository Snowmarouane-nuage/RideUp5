# RIDE'UP (RideMind4)

Plateforme SaaS de coaching pour sports de glisse — kitesurf, wakeboard, foil et surf.

## Stack

- **Frontend** : React 19 + Tailwind (`frontend/`)
- **Backend** : FastAPI + MongoDB (SQLite en secours en local)
- **Auth** : Email / mot de passe (compte RIDE'UP)
- **Paiement** : Stripe (abonnements mensuels)
- **IA** : OpenAI GPT-4o vision (analyse vidéo) + Anthropic Claude (coach & spots via `ANTHROPIC_API_KEY`)

---

## Guide de finalisation — de A à Z

### Phase 1 — Faire tourner le site en local

```bash
# 1. Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # puis remplir les clés
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# 2. Frontend (autre terminal)
cd frontend
npm install
cp .env.example .env
npm start
```

→ Frontend : http://localhost:3000  
→ API : http://localhost:8000

**Sans MongoDB** : le backend utilise automatiquement SQLite (`backend/data/local.db`).

---

### Phase 2 — Comptes & clés à créer

| Service | URL | Variable `.env` | Obligatoire pour |
|---------|-----|---------------|------------------|
| **OpenAI** | [platform.openai.com](https://platform.openai.com) | `OPENAI_API_KEY` | Analyse vidéo réelle |
| **Stripe** | [dashboard.stripe.com](https://dashboard.stripe.com) | `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` | Vrais paiements |
| **Resend** | [resend.com](https://resend.com) | `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL` | Emails (reset MDP, vérification) |
| **MongoDB Atlas** | [mongodb.com/atlas](https://www.mongodb.com/atlas) | `MONGO_URL` | Prod / données persistantes |
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com) | `ANTHROPIC_API_KEY` (`sk-ant-...`) | Coach chat & Spot Finder |

**Admin** : `ADMIN_EMAILS=snowmarouane@gmail.com` dans `backend/.env`

**Frontend prod** : `REACT_APP_SITE_URL=https://ton-domaine.com` dans `frontend/.env`

---

### Phase 3 — Tester chaque fonctionnalité

| # | Test | URL |
|---|------|-----|
| 1 | Créer un compte | `/login` |
| 2 | S'abonner (dev = activation auto sans Stripe) | `/pricing` |
| 3 | Dashboard rider | `/dashboard` |
| 4 | Analyse vidéo (clip ≤ 20s) | `/video-analysis` |
| 5 | Coach personnel | `/coach` |
| 6 | Cours | `/courses` |
| 7 | Spot Finder (Premium) | `/spot-recommender` |
| 8 | Spots week-end (public) | `/meilleurs-spots-kitesurf-weekend` |
| 9 | Admin site | `/admin` (email admin uniquement) |

**Carte test Stripe** : `4242 4242 4242 4242`

---

### Phase 4 — Stripe (webhooks)

**En local** (3 terminaux : backend, frontend, webhook) :

```bash
# Terminal 3 — après stripe login
chmod +x backend/scripts/stripe_listen.sh
./backend/scripts/stripe_listen.sh
```

Copie le `whsec_...` affiché dans `backend/.env` :

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

Redémarre le backend. Sans ce secret, le paiement Stripe réussit mais l'abonnement ne s'active pas automatiquement (le polling `/payment-success` peut quand même fonctionner via `/checkout/status`).

**En production** :

1. Créer les produits **Standard** (9,99 €/mois) et **Premium** (15,99 €/mois) dans Stripe
2. `STRIPE_API_KEY=sk_live_...` (ou `sk_test_...` pour tester)
3. Dashboard Stripe → **Developers → Webhooks** → endpoint `https://ton-api.com/api/webhook/stripe`
4. Événements à écouter : `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Copier le signing secret → `STRIPE_WEBHOOK_SECRET`

---

### Phase 5 — Emails Resend (mot de passe oublié + vérification)

1. Créer un compte sur [resend.com](https://resend.com)
2. Vérifier ton domaine (ou utiliser le domaine test Resend en dev)
3. Créer une API key → `RESEND_API_KEY=re_...`
4. Dans `backend/.env` :

```
RESEND_API_KEY=re_...
EMAIL_FROM=RIDE'UP <noreply@ton-domaine.com>
FRONTEND_URL=http://localhost:3000
```

**Sans Resend en local** : les liens reset et vérification apparaissent dans les **logs du backend**. Les nouveaux comptes sont auto-vérifiés en dev si Resend n'est pas configuré.

**Avec Resend** : chaque inscription envoie un email → l'utilisateur doit cliquer `/verify-email?token=...` avant de s'abonner ou d'utiliser l'analyse vidéo.

---

### Phase 6 — Déployer en ligne

**Frontend** (Vercel, Netlify, etc.) :
- Build : `npm run build`
- Env : `REACT_APP_BACKEND_URL`, `REACT_APP_SITE_URL`
- Mettre à jour `public/sitemap.xml` et `robots.txt` avec ton domaine

**Backend** (Railway, Render, Fly.io, VPS) :
- Env : toutes les variables de `backend/.env.example`
- `ENV=production`, `CORS_ORIGINS=https://ton-domaine.com`, `COOKIE_SECURE=true`
- MongoDB Atlas obligatoire en prod

---

### Phase 7 — SEO & lancement

- [ ] Domaine + HTTPS
- [ ] `REACT_APP_SITE_URL` configuré
- [ ] Sitemap & robots.txt à jour
- [ ] Google Search Console : soumettre le sitemap
- [ ] Tester les meta tags (title, description) par page

---

## Fonctionnalités & accès

| Page | Accès |
|------|-------|
| Accueil, Spots week-end, Légal | Public |
| Cours | Public (contenu verrouillé sans abo) |
| Login / Inscription | Public (email vérifié requis pour abo & analyse) |
| Dashboard, Coach, Analyse vidéo | Compte + abonnement |
| Spot Finder | Compte + Premium |
| Admin | Email dans `ADMIN_EMAILS` |

---

## Analyse vidéo

1. Clip **≤ 20 secondes**, max 100 MB
2. Sport choisi → coach expert dédié (kite, wake, foil, surf)
3. ~8 captures extraites → analyse structurée (diagnostic, corrections, drills)
4. **Clé requise** : `OPENAI_API_KEY` + crédit actif sur le compte OpenAI

---

## Fichiers `.env` — exemple minimal local

**backend/.env**
```
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=ridemind
OPENAI_API_KEY=sk-proj-...
STRIPE_API_KEY=sk_test_...
ADMIN_EMAILS=snowmarouane@gmail.com
ENV=development
CORS_ORIGINS=http://localhost:3000
COOKIE_SECURE=false
```

**frontend/.env**
```
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_SITE_URL=http://localhost:3000
```

---

## Dépannage rapide

| Problème | Solution |
|----------|----------|
| Inscription échoue | MongoDB down → SQLite auto, ou installer MongoDB |
| Paiement erreur | Stripe non configuré → mode démo en local, ou ajouter `STRIPE_API_KEY` |
| Analyse vidéo erreur | Quota OpenAI → ajouter crédit sur platform.openai.com/billing |
| Pas de bouton Admin | Se connecter avec l'email dans `ADMIN_EMAILS` |

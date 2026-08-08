# Déploiement

Ce guide couvre le déploiement : **OpenWA** (la passerelle WhatsApp) et l'**app mobile**, qui **se connecte directement à l'API OpenWA** — sans backend intermédiaire.

> **Architecture « directe »** : l'app mobile appelle `https://openwa.votre-domaine.com/api/...` avec la clé API OpenWA. Les contacts sont stockés sur le téléphone (AsyncStorage). Les nouveaux messages arrivent par **polling** (l'app rafraîchit toutes les ~5 s). Aucun serveur applicatif n'est nécessaire — uniquement OpenWA.

## Prérequis Hostinger

- Hébergement **mutualisé Business** (ou supérieur) — le support Node.js « Web Apps » est requis.
- Un nom de domaine + sous-domaine : `openwa.votre-domaine.com` (passerelle WhatsApp).
- Un compte **GitHub** (déploiement automatique).

---

## 0. Le dépôt GitHub (déploiement automatique)

Hostinger Web Apps se connecte à un dépôt GitHub et **redéploie automatiquement à chaque `git push`**. Un seul dépôt `crm-whatsapp` suffit : Hostinger gère les monorepos via le réglage **Root directory** (une Web App par sous-dossier).

Dépôt : `https://github.com/Agascom/crmwhatsapp.git`

Structure :

```
crm-whatsapp/
├── mobile/      → l'app (Expo), se connecte directement à OpenWA
└── openwa/      → Web App Hostinger (Root directory: openwa)  ← OpenWA v0.14.6 sans Docker
```

> Le dossier `backend/` est conservé mais **n'est plus utilisé** : l'app mobile parle directement à OpenWA.

### 0.1 Règles d'or

| Faire | Ne PAS faire |
|---|---|
| Committer `package.json` + `package-lock.json` | Committer `node_modules/` |
| Committer `.env.example` (valeurs factices) | Committer `.env` (mots de passe, clé API) |
| Committer `openwa/dist/` (pré-compilé, voir §1.3) | Compiler chez Hostinger (mémoire insuffisante) |
| Saisir les secrets dans hPanel → **Environment variables** | Mettre la clé API OpenWA dans l'app mobile |

> Les variables d'environnement saisies dans hPanel persistent entre les déploiements.

### 0.2 Créer les deux Web Apps (hPanel)

1. **Websites → Add Website → Node.js web app → Import Git repository → Connect with GitHub** (installez l'app GitHub Hostinger, autorisez `Agascom/crmwhatsapp`).
2. Sélectionnez `crmwhatsapp` — la config se pré-remplit.
3. Configurez chaque app comme décrit ci-dessous (§1 pour `openwa`, §2 pour `backend`).
4. **Deploy.** Chaque push sur `main` relance le déploiement automatiquement.

> ⚠️ Ne définissez jamais `PORT` dans les variables d'environnement : Hostinger l'injecte automatiquement.

---

## 1. Déployer OpenWA (la passerelle WhatsApp)

OpenWA tourne comme **application Node.js** sur le même hébergement (une 2e « Web App »). Pas de Docker possible en mutualisé.

### 1.1 Le code

OpenWA v0.14.6 est versionné dans **`openwa/`**, sans les fichiers Docker (`Dockerfile`, `docker-compose*.yml`, `.dockerignore`, `docker-entrypoint.sh`, `charts/`) — inutilisables en mutualisé. Le `.env.example` et le `.npmrc` (`engine-strict=false`) sont fournis.

> `ENGINE_TYPE=baileys` est **obligatoire** : ce moteur ne demande pas de Chromium (~30-80 Mo RAM/session) contrairement à `whatsapp-web.js`. Sans lui, OpenWA utilise le moteur par défaut `whatsapp-web.js` (lourd et fragile en mutualisé).

### 1.2 Port et compatibilité

- OpenWA 0.14.6 lit déjà `process.env.PORT` (défaut `2785`) — **aucun patch nécessaire**.
- La vérification npm des moteurs (`EBADENGINE`, typeorm exige `^22.13.0 || >=24.11.0`) est neutralisée par `.npmrc` + la variable `NPM_CONFIG_ENGINE_STRICT=false`. Les avertissements qui restent (undici/jsdom) sont sans conséquence.

### 1.3 Configuration de la Web App (hPanel)

1. **Add Website → Node.js web app → Import Git repository** → sélectionnez `crmwhatsapp`.
2. **Root directory** : `openwa`.
3. **Node.js version** : **22** (ou 24).
4. **Build command** : **laisser VIDE** — le dossier `dist/` pré-compilé est déjà committé. En cas de modification du code, régénérez en local puis committez :
   ```bash
   cd openwa && npm ci && npm run build
   cd dashboard && npm ci && npm run build && cd ..
   git add openwa/dist openwa/dashboard/dist && git commit -m "openwa: regen dist + dashboard" && git push
   ```
5. **Entry file** : `dist/main.js`.
6. **Variables d'environnement** :

   | Variable | Valeur |
   |---|---|
   | `ENGINE_TYPE` | `baileys` |
   | `DATABASE_TYPE` | `sqlite` |
   | `NODE_ENV` | `production` |
   | `BASE_URL` | `https://openwa.votre-domaine.com` |
   | `NPM_CONFIG_ENGINE_STRICT` | `false` |

   (Hostinger injecte `PORT` lui-même.)
7. **Deploy**, puis ouvrez `https://openwa.votre-domaine.com` → dashboard OpenWA.
8. Créez une **session** WhatsApp, scannez le **QR**, attendez le statut **ready**.
9. Récupérez la **clé API** : menu **API Keys** (ou fichier `data/.api-key` via le File Manager).

### 1.4 Garder la connexion vivante (cron)

Le mutualisé peut « endormir » le process inactif → WhatsApp se déconnecte. Dans hPanel → **Cron Jobs**, toutes les 5 minutes :

```
curl -s https://openwa.votre-domaine.com/api/health > /dev/null 2>&1
```

> ⚠️ La clé API OpenWA est saisie dans l'app mobile (premier lancement) et stockée sur le téléphone — elle ne doit apparaître dans aucun dépôt public.

---

## 2. Backend CRM (optionnel — non utilisé par l'app)

> Depuis la version « connexion directe », l'app mobile n'a **plus besoin** du backend. Cette section ne sert que si vous souhaitez conserver une API dédiée plus tard.

### 2.1 Variables d'environnement (hPanel)

| Variable | Valeur |
|---|---|
| `ADMIN_USER` | `admin` |
| `ADMIN_PASSWORD` | *mot de passe fort* |
| `JWT_SECRET` | *longue chaîne aléatoire* |
| `PUBLIC_URL` | `https://crm.votre-domaine.com` |
| `OPENWA_URL` | `https://openwa.votre-domaine.com` |
| `OPENWA_API_KEY` | *clé récupérée au §1.3* |
| `OPENWA_SESSION_ID` | *nom de la session* (ex. `default`) |
| `WEBHOOK_SECRET` | *longue chaîne aléatoire* |
| `DATABASE_URL` | *chaîne de connexion Neon (SSL)*, ex. `postgresql://user:password@host.neon.tech/dbname?sslmode=require` |

> Ne définissez **pas** `PORT` : Hostinger l'injecte (le backend a un fallback à 3000). `PUBLIC_URL` est l'URL du **backend** (c'est lui qui reçoit les webhooks OpenWA). Générez `JWT_SECRET` et `WEBHOOK_SECRET` avec :
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```
> 🔒 `DATABASE_URL` contient le mot de passe : saisissez-le **uniquement** dans hPanel (Environment variables), ne le committez jamais (le `.env` est ignoré par git).

### 2.2 Configuration de la Web App (hPanel)

1. **Websites → Add Website → Node.js web app → Import Git repository** → sélectionnez `crmwhatsapp`.
2. **Root directory** : `backend`.
3. **Node.js** : **22**.
4. **Build command** : **laisser VIDE** — les tables Postgres sont créées automatiquement au premier démarrage (`ensureSchema`, idempotent). Le script `npm run init-db` reste disponible pour une initialisation manuelle en local.
5. **Entry file** : `src/server.js`.
6. **Variables d'environnement** : saisissez le tableau du §2.1.
7. **Deploy.**

> Le backend **ne crashe plus** si la base est momentanément injoignable : il écoute immédiatement, retente la connexion pendant ~50 s et écrit chaque étape dans `backend/src/server.log` (visible dans hPanel → File Manager). `/health` répond toujours.

### 2.3 Vérifier

- `https://crm.votre-domaine.com/health` → `{"status":"ok"}`
- Au démarrage, les logs affichent `Webhooks OpenWA: [{"session":"...","status":"enregistre"}]`.
- Le backend enregistre automatiquement son webhook sur chaque session OpenWA.

---

## 3. App mobile (connexion directe OpenWA)

1. `cd mobile` puis `npm install`.
2. Dans `app.json`, renseignez `extra.owaUrl` avec l'URL d'OpenWA (ex. `https://openwa.votre-domaine.com`). Vous pouvez aussi y pré-remplir `extra.owaApiKey` (déconseillé : la clé serait alors présente dans le binaire).
3. `npx expo start`, testez avec **Expo Go** sur votre téléphone.
4. Au premier lancement, saisissez **l'adresse OpenWA** et la **clé API** (menu API Keys du dashboard OpenWA, rôle **OPERATOR** pour envoyer des messages). Elles sont mémorisées sur le téléphone (SecureStore).
5. Pour un APK autonome : `npx expo run:android` ou un build EAS (`npx eas build --profile preview`).

L'écran de connexion et les Paramètres permettent de modifier l'adresse et la clé depuis le téléphone.

> **Limites sans backend** : les messages entrants apparaissent au polling (~5 s) quand l'app est ouverte ; pas de notifications push en arrière-plan. Les contacts (statuts prospect/client/finalisé) sont stockés localement sur le téléphone. La clé API est embarquée dans l'app → toute personne avec l'APK peut l'extraire ; elle ne donne accès qu'à la session WhatsApp (pas au téléphone ni à WhatsApp).

---

## Ordre de mise en route

1. Déployer **OpenWA** + connecter le numéro (QR) + récupérer la clé API (rôle OPERATOR).
2. Installer et tester l'**app mobile** (saisir URL + clé au premier lancement).
3. Optionnel : garder OpenWA éveillé avec le cron §1.4.

## Dépannage rapide

| Problème | Solution |
|---|---|
| Échec d'installation `EBADENGINE` | Normal, neutralisé par `.npmrc` / `NPM_CONFIG_ENGINE_STRICT=false` — vérifier que le déploiement continue |
| Échec de **compilation** | Build command doit être **vide** (dossier `dist/` committé) |
| `Aucune session WhatsApp prête` | Le numéro n'est pas connecté dans le dashboard OpenWA |
| `Clé API invalide` dans l'app | Vérifier la clé dans Paramètres (dashboard OpenWA → API Keys) |
| Envoi refusé (403) | La clé API doit avoir le rôle **OPERATOR** |
| L'app ne voit pas les nouveaux messages | Vérifier le cron de maintien OpenWA + que l'app reste ouverte (polling ~5 s) |

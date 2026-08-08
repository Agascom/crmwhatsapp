# Déploiement

Ce guide couvre le déploiement complet : **OpenWA**, le **backend CRM** et l'**app mobile**, sur l'hébergement mutualisé Hostinger. Il reflète la configuration validée pendant le développement (les pièges rencontrés sont intégrés directement).

## Prérequis Hostinger

- Hébergement **mutualisé Business** (ou supérieur) — le support Node.js « Web Apps » est requis.
- Un nom de domaine + sous-domaines : `crm.votre-domaine.com` (backend) et `openwa.votre-domaine.com` (passerelle).
- Une base de données **PostgreSQL Neon** (gratuite, distante, accès SSL) — l'accès MySQL local du mutualisé échouait (`Access denied`), Neon est accessible depuis n'importe où.
- Un compte **GitHub** (déploiement automatique).

---

## 0. Le dépôt GitHub (déploiement automatique)

Hostinger Web Apps se connecte à un dépôt GitHub et **redéploie automatiquement à chaque `git push`**. Un seul dépôt `crm-whatsapp` suffit : Hostinger gère les monorepos via le réglage **Root directory** (une Web App par sous-dossier).

Dépôt : `https://github.com/Agascom/crmwhatsapp.git`

Structure :

```
crm-whatsapp/
├── backend/     → Web App n°1 (Root directory: backend)
├── openwa/      → Web App n°2 (Root directory: openwa)  ← OpenWA v0.14.6 sans Docker
└── mobile/      → versionné seulement, non déployé chez Hostinger
```

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

> ⚠️ La clé API OpenWA va **uniquement** dans les variables d'environnement du backend CRM. Jamais dans l'app mobile.

---

## 2. Déployer le backend CRM

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
4. **Build command** : `npm run init-db` (crée les tables **Postgres** sur Neon, idempotent — nécessite `DATABASE_URL` déjà défini dans les variables).
5. **Entry file** : `src/server.js`.
6. **Variables d'environnement** : saisissez le tableau du §2.1.
7. **Deploy.**

> Initialiser les tables une seule fois est suffisant ; le schéma est idempotent (`IF NOT EXISTS`) et `npm run init-db` peut être relancé sans risque.

### 2.3 Vérifier

- `https://crm.votre-domaine.com/health` → `{"status":"ok"}`
- Au démarrage, les logs affichent `Webhooks OpenWA: [{"session":"...","status":"enregistre"}]`.
- Le backend enregistre automatiquement son webhook sur chaque session OpenWA.

---

## 3. App mobile

1. `cd mobile` puis `npm install`.
2. Dans `app.json`, renseignez `extra.apiUrl` avec `https://crm.votre-domaine.com`.
3. `npx expo start`, testez avec **Expo Go** sur votre téléphone.
4. Pour un APK autonome : `npx expo run:android` ou un build EAS (`npx eas build --profile preview`).

L'écran de connexion permet aussi de modifier l'adresse du serveur depuis le téléphone.

---

## Ordre de mise en route

1. Déployer **OpenWA** + connecter le numéro (QR) + récupérer la clé API.
2. Déployer le **backend** (avec clé API + webhook).
3. Vérifier `health` + les logs webhooks.
4. Installer et tester l'**app mobile**.

## Dépannage rapide

| Problème | Solution |
|---|---|
| Échec d'installation `EBADENGINE` | Normal, neutralisé par `.npmrc` / `NPM_CONFIG_ENGINE_STRICT=false` — vérifier que le déploiement continue |
| Échec de **compilation** | Build command doit être **vide** (dossier `dist/` committé) |
| `Aucune session WhatsApp prête` | Le numéro n'est pas connecté dans le dashboard OpenWA |
| Webhooks non enregistrés | Vérifier `PUBLIC_URL` (doit être HTTPS et public) et que la clé API a le rôle OPERATOR |
| L'app ne reçoit pas les messages | Vérifier le cron de maintien OpenWA + les logs du backend |
| Erreur de connexion Neon au démarrage | Vérifier `DATABASE_URL` (SSL obligatoire, `sslmode=require`) dans hPanel ; le backend écrit les erreurs dans `server.log` |

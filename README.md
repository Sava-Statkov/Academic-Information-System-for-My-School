# School Display System

A small browser-based schedule display web app. This repository contains the frontend files needed to run the app locally and publish to a Git host (GitHub).

Quick start

1. Copy `firebase.example.js` to `firebase.js` and fill in your Firebase project values (see the file header for instructions).
2. Confirm `firebase.js` is listed in `.gitignore` so you don't commit secrets.
3. Open `index.html` in a browser, or serve the folder with a simple static server.

Publish to GitHub

Initialize the repo locally (if not already):

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:USERNAME/REPO.git
git push -u origin main
```

If you want to host the app on GitHub Pages, enable Pages in your repository settings and set the publishing source (usually `main` branch).

Security notes

- Do not commit `firebase.js` (contains API keys and identifiers). Keep it local and secure.
- Use Firebase Security Rules to protect your Firestore data — client-side keys are public by design and require rules to be enforced server-side.
- Rotate API keys if they are accidentally published.

Files created by this commit

- `firebase.example.js` — example config you should copy & fill
- `.gitignore` — ignores common sensitive files and OS/editor artifacts
- `SECURITY.md` — short guidance for keeping secrets safe
- `.gitattributes` — normalize line endings

If you'd like, I can also create a minimal GitHub Actions workflow to run automated checks before push.

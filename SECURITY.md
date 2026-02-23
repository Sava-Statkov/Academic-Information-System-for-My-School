# Security

Keep secrets out of the repository. This project may contain Firebase client config which is not a secret by itself but should still be kept out of a public repo unless your Firebase rules are properly restrictive.

Recommendations

- Do not commit `firebase.js` (it is ignored in `.gitignore`).
- Use `firebase.example.js` for a template of the config.
- Review and apply strict [Firebase Security Rules](https://firebase.google.com/docs/rules).
- If keys are accidentally published, rotate them from the Firebase Console immediately.

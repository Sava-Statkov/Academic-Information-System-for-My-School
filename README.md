# School Display System

This is a browser-based web app for displaying weekly school schedules and events. It is designed for easy use and customization by schools.

## Features

- View weekly class schedules by grade and section
- Browse upcoming school events and achievements
- Responsive design for desktop and mobile
- Secure integration with Firebase Firestore (for schedule data)

## Setup & Usage

1. Copy `firebase.example.js` to `firebase.js` and fill in your Firebase project values (see the file header for instructions).
2. Make sure your images are placed in the `images/` folder and referenced as `images/filename.ext` in the code.
3. Open `index.html` in your browser, or use a simple static server to view the site locally.

## Security Notes

- Do not commit `firebase.js` (contains API keys and identifiers). Keep it local and secure.
- Use Firebase Security Rules to protect your Firestore data. Client-side keys are public by design; security must be enforced server-side.

## Customization

- Edit `index.html` and `style.css` to change the layout, colors, or add new sections.
- Add or update images in the `images/` folder. Make sure all image paths in your code use the `images/` prefix.
- Update schedule and event data in Firestore as needed.

## Requirements

- Modern web browser (Chrome, Firefox, Edge, Safari)
- Firebase project (for schedule storage)

For any questions or help, see the comments in the code files or contact your school IT administrator.
# MDCAT Practice

A small static quiz site for practicing MDCAT MCQs. No backend, no build step —
just HTML, CSS and JS, hosted for free on GitHub Pages.

## What's in here

```
index.html            the page
style.css              all styling
app.js                 all the quiz logic
data/manifest.json     lists which years of questions exist and where to find them
data/questions-2025.json   the 2025 question bank (310 questions)
```

## Adding a new year later (e.g. 2024)

1. Create `data/questions-2024.json` in the exact same shape as
   `data/questions-2025.json` — an array of objects like:
   ```json
   { "id": 1, "year": 2024, "paper": "Some Paper Name", "subject": "Biology",
     "no": 12, "q": "Question text?",
     "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
     "answer": "B" }
   ```
2. Open `data/manifest.json` and change the 2024 entry's `"available": false`
   to `"available": true`.
3. Commit the changes. That's it — no other file needs to change, and the
   year filter on the site will pick it up automatically.

## Adding or fixing a question in the existing set

Open `data/questions-2025.json`, find the question by its `id`, edit the
text/options/answer, save, and commit. The site reads this file fresh each
time it loads.

## Notes

- `answer` must be one of the letter keys used in that question's `options`.
- `no` is the question's original number in its source paper — shown in the
  quiz so it's traceable back to the original paper.

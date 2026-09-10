# MDCAT Question Bank — Clean GitHub Pages Package

This is the cleaned 2024 + 2025 MDCAT question-bank website.

## Clean database

The database was rebuilt from the supplied `2024 1.json` and `2025 1.json`.

Records excluded from the published database:
- Every 2024 question carrying any source flag (including missing answer key, OCR review, deleted, diagram, ambiguous/multiple-answer, or answer-key integrity flags).
- The single 2025 malformed record with no answer.
- Seven 2025 records explicitly marked `needs_review`.
- Three additional 2024 records with invalid/empty option data.

Published database:
- 2024: 866 MCQs
- 2025: 1,040 MCQs
- Total: 1,906 MCQs

The original question number, paper, subject, answer, and source metadata are preserved. A separate global `id` and `uid` are used by the website so attempt history remains stable.

## Important accuracy note

This cleaning process makes the published set **source-clean and internally consistent**: remaining questions have an answer present in the source data, the answer points to an available option, and the question is not marked with one of the source review/error flags described above.

It does **not** constitute independent factual re-solving of all 1,906 questions. An absolute guarantee that every question and official key is factually correct would require independently checking every item against authoritative paper/answer-key sources. Do not represent the dataset as independently verified 100% factual accuracy unless that separate validation has been completed.

## Website features

- 2024 / 2025 / All Years
- Dynamic paper selection
- `AS — All Subjects`
- Practice mode
- Random Test
- Paper Test
- Revision
- Attempt history
- Question palette
- Original question number display
- A–E option support
- Local question editor
- JSON import/export
- Dark/light mode
- Mobile responsive layout

## GitHub Pages

1. Create a public GitHub repository, for example `mdcat-question-bank`.
2. Upload every file in this folder to the repository root.
3. Go to **Settings → Pages**.
4. Select **Deploy from a branch**.
5. Select branch **main** and folder **/(root)**.
6. Save and open the published GitHub Pages URL.

## Updating the database

When you receive a later year, merge it into the same structure and keep a numeric `year` field. The website automatically builds year, paper, and subject filters from the JSON.

The browser editor stores changes locally. To publish permanent changes, export the JSON and replace the repository's `questions.json`.

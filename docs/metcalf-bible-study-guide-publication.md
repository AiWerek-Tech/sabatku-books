# Penuntun Dasar untuk Pemahaman Alkitab

Initial publication: supplied Part I, five topics, 31 numbered source questions and five conclusions. Source: 15 scans in the project owner's `D:/SABATKU-KONTEN/BUKU/Suplemen ALkitab` folder. The scans include title/credits, three contents pages, and printed pages 7–16. Source scans are retained outside the public repository except the title page used as the cover.

The catalog explicitly describes this as a partial book. Only available readings enter the navigable contents. Parts II–XII are not represented by empty chapters or fabricated content. New parts must use stable `part-02` and `topic-02-01` style IDs and a new immutable edition revision.

## Editorial decisions

- Preserve author questions, answers, source quotations, notes and conclusions. Repair scan line wrapping and mechanical spacing only.
- Expand implicit Genesis chapter/verse references to explicit labels; repeat book/chapter on comma-separated verse references so individual references open independently.
- Correct the demonstrable printed reference `1 Timotius 2:18` to `2 Timotius 2:18`; 1 Timothy chapter 2 has no verse 18, while the quoted description concerns 2 Timothy 2:18.
- Preserve the printed historical/numerical claims, including the inconsistent Nineveh area units, rather than silently replacing the source author's material. The source statement is not an independently fact-checked modern historical account.
- Collins World is printed on the title page. LAI is explicitly identified as printer. The 2005 revision credit is not used as an inferred printing/publication year.
- Publication authorization is the owner's explicit instruction to implement and publish. No new written publisher permission has been independently obtained or claimed.

## Reader integration

Use the existing Books catalog and hierarchical contents, online chapter fetch, verified offline edition cache, search, reading position, annotations and bookmarks. Android's main book reader connects detected Bible references to the existing scripture modal; it selects TB for Indonesian editions and KJV for English editions. The modal can open the full Bible reader. App code changes require a later Android build; publishing the book itself updates the remote catalog immediately after Pages deployment.

No English edition or PDF is declared because neither was supplied. No scheduled seven-day reading plan is manufactured for this topical reference book.

## Follow-up source and reader audit

The ten supplied content scans (printed pages 7–16) were compared again with all five topics, including cross-page continuations on pages 8, 10, 13, 15 and 16. Inventory: 31 numbered questions, 15 author notes, 28 quotation paragraphs, five study principles and five conclusions. Source page mappings and fingerprints for all 15 supplied scans are recorded in `metcalf-source-audit.json`.

Revision 3 removes repeated `Baca` commands introduced by expanding comma-separated references. No source explanation or author note is removed. Explicit book/chapter expansions, normalized spacing/capitalization and the documented Timothy reference correction remain deliberate editorial differences from the printed source.

Android adds an in-topic question navigator and a conclusion shortcut. Question titles, quotations, notes and study principles have distinct theme-aware surfaces. All body text stays expanded and retains the existing Bible links, annotation actions, font controls, search and reading anchors. The navigator uses existing block indexes without inserting synthetic content blocks or new response fields.

Validation: 17 publishing tests pass. Android tests replay all five source documents through the actual reader Markdown parser and compare all visible words after markup/whitespace normalization; question destinations and counts are checked. Physical-device rendering and touch interaction remain unverified until an authorized APK/device session.

## Chapter VII addition

The owner-supplied Markdown transcription for printed pages 78–96 was added as Part VII, “Hukum Allah,” with ten topic sections and 65 numbered questions. Numbered questions use the existing collapsible question/answer reader; conclusions and author notes retain their existing reader styling. Page labels, page-break separators, and transcription continuation notes were removed. Fragments split only by printed page breaks were joined where the supplied continuation clearly completed the same sentence. The wording was otherwise preserved.

The catalog revision was advanced to 6. The source Markdown page sequence and question numbering were checked programmatically. The original scan images were not visually proofread word-for-word against this transcription; this is recorded in `metcalf-chapters-02-07-audit.json`.

## Chapter VI addition

The owner-supplied Markdown transcription for printed pages 68–77 was added as Part VI, “Jalan Kebenaran,” before Part VII. The ten corresponding page scans (`Bab-6 (1).jpg` through `Bab-6 (10).jpg`) were visually checked page by page against the transcription, including sentence continuations across page breaks. The five topics contain 30 numbered questions (6, 9, 5, 3, and 7). Wording and source order were preserved; only page labels, extraction notes, and page-break separators were omitted, and split sentences were joined at their original continuation points.

The catalog revision is now 7. Chapter VI is registered before Chapter VII in the reader's contents. The audit JSON records the page-by-page review and question sequence. The book as a whole remains a partial publication: other chapters still need their own source review and publication work.

## Chapter V addition

Revision 8 registers the supplied Chapter V transcription (printed pages 49–67), five topics and 52 numbered questions, before Chapter VI. Wording is preserved; extraction notes and page labels are omitted. Split sentences are joined. Full word-for-word visual verification against all 19 scans remains pending.

## Chapter IV addition

Revision 9 registers the supplied Chapter IV transcription, printed pages 38–48, with four topics and 33 questions. Extraction notes are excluded and page-break sentence fragments joined. Source wording is preserved. Full visual proofreading against scans remains pending.

## Chapter III addition

Revision 10 registers the supplied Chapter III transcription (pages 24–37): seven topics, 52 questions. All topic body text was compared after markup and whitespace normalization with the supplied transcription; words and punctuation were preserved. Page labels are omitted and cross-page sentence fragments joined. Full visual scan verification remains pending.

## Chapter II completion

Revision 11 replaces the earlier partial Chapter II with the supplied pages 17–23 transcription: four topics, 23 questions. All body words and punctuation were verified against the supplied Markdown after markup/whitespace normalization. Extraction notes are excluded; cross-page sentences joined. Full visual scan proofreading remains pending.

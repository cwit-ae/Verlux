# Changelog

All notable changes to Verlux are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each entry names *what* changed and, where the reasoning is not obvious from the change itself, *why* — so future readers can decide whether a release is relevant to them without re-reading the diff.

## [Unreleased]

### Changed

- **The internal safelist is now keyed by language instead of being a single flat set.** `SAFE_WORDS` was one global `Set<string>` consulted before every match tier, so excusing a word for one language blinded the detector to it in *every* language. That is why the 1.0.14 entry below had to record a permanent trade-off: safelisting the everyday English words `bite`/`bites` made the French entry `bite` undetectable even in genuine French text. The safelist is now `SAFE_WORDS_BY_LANGUAGE`, a `Map` of language code → word list, resolved into a flat set once per index build by the new exported `resolveSafeWords(languages)`. A bucket is active only when that language's dictionary is loaded; a `*` bucket (acronyms, brands, proper nouns such as `bbc`, `nike`, `wang`, `rand`) is always active. Words are keyed by the language in which they are *innocent*, not the language whose dictionary produces the false match — so `con` and `bite` live in the `en` bucket and are excused under the default all-languages config, while `createInstance({ languages: ['fr'] })` drops that bucket and detects both French words normally. **Under the default config the effective safelist is the union of all buckets and is byte-for-byte the set it replaced** (997 entries, plus the four added below), so default-config behaviour is unchanged. Matching cost is unchanged — still one `Set.has` per token; the resolution step adds ~45 µs to a ~3.2 ms index build, which is already cached per language set.

- **Neutral crime/report nouns removed from the English dictionary — `fraud`, `scammer`, `thief`, and `crook`.** These four entries (category `insult`, severity `medium`) collectively covered `fraud` / `frauds` / `fr4ud` / `fraudster` / `fraudsters`, `scammer` / `scam` / `scammers` / `sc4mmer` / `scamm3r`, `thief` / `th1ef` / `thi3f` / `thieves` / `thiefs`, and `crook` / `cr00k` / `crooks`. In customer-support text these words overwhelmingly name the *subject* of a conversation — _"I want to report fraud on my account"_, _"is this a scam?"_, _"my card was stolen by a thief"_ — rather than abuse aimed at an agent, so exact-matching them produced unacceptable false positives on ordinary fraud, dispute, and security reports (the reason most people call a bank). They were previously flagged intentionally; that decision is reversed. The package's profanity purpose is unchanged: every other insult, slur, threat, and dehumanising term still matches, and overt abuse of the form _"you are a …"_ remains covered by the phrase dictionary. Callers who need these terms flagged for their own use case can re-add them with `addWords()`.

### Fixed

- **The transliteration tier no longer matches outside `hi-latn`, ending a whole class of high-severity false positives on everyday non-Hindi words.** `transliterate()` exists to catch Hindi/Urdu abuse written in Roman script, where there is no standard spelling, and it gets there with a deliberately lossy cumulative phonetic fold (`kh→k`, `bh→b`, `dh→d`, `sh→s`, `th→t`, `ph→f`, `ai→e`, `oo→u`, `ee→i`). Tier 2.5 in `matchToken` then looked the folded skeleton up in the **unified** index — every loaded language at once — so any word in any language that happened to share a skeleton with a dictionary entry was flagged. Ordinary vocabulary was reported as severe abuse: `pushy` → `pusy` → **`pussy`** (high), `nigh` → `nig` → **`nigger`** (high), `dikhai` (Hindi for "visible" — _"mujhe dikhai de raha hai"_) → `dike` → **`dyke`** (high), `neep`/`neeps` → **`nip`** (high), `theta`/`thetas` → Spanish **`tetas`**, `jeez` → **`jizz`**, `cools` → French **`cul`**, `farthing` → **`fart`**, plus `cauk`, `coonty`, `deek`, `scath`, `leear(s)`, `fouth`, `pithos`. The tier is now scoped to the single language it was built for via the new `TRANSLITERATION_LANGUAGE` constant. **This costs no detection at all:** every other language's surface forms are already reachable through Tier 1 (exact) and Tier 2 (`normalizeVariants`), which is now asserted differentially — whatever the default config detects, the same config with `transliteration: false` must detect too. Hindi detection is untouched, including the alternate romanizations the fold exists for (`benchod`, `bhencod`, `madarcod`, `chootiya`, `bhosadike`). The broad English audit drops from 166 to 144 flagged words with no regressions.

- **Everyday romanized Hindi words no longer flagged via folds onto a `hi-latn` root.** The scoping above cannot help where the collision is *within* the Hindi dictionary, so these are handled by a new `hi-latn` safelist bucket: `shaala`/`shala` (शाला, school — folds to `sala`, the `normalized` form of `saala`), `chhoot`/`achhoot` (छूट, a discount; छूत, contagion — folds to the high-severity `chut`, so _"50% chhoot"_ was severe profanity), `gandh` (गंध, smell — folds to `gand`, a `normalized` form of `gaand`, high), and `lodha` (a common Indian surname and a major property developer — folds to `loda`, a listed alias of `lund`, high). One further case, `phool` (फूल, flower), is produced by the l33t normalizer's `ph→f` sequence at Tier 2 rather than by the transliterator, and is safelisted alongside them. Per the keying rule these sit in the `hi-latn` bucket because that is the language in which they are legitimate words; `createInstance({ languages: ['en'] })` drops the bucket, which is the correct trade — in English-only text `phool` really is a `ph→f` obfuscation of `fool`, exactly as `phuck` is of `fuck`. Only the exact colliding surface forms are listed: compounds (`vidyashaala`, `dharamshala`, `sugandh`, `gandhak`, `phoolon`, `lodhi`, `gandhi`, `choudhary`) already come out clean and are deliberately not blanket-safelisted. The `chhut` spelling is likewise **not** safelisted — it is a listed `normalized` form of `chut`, i.e. a genuine obfuscation. The canonical roots (`saala`, `chut`, `choot`, `gaand`, `gand`, `lund`, `loda`, `lauda`, `lawda`, `fool`) all remain detectable.

- **Hindi written in Devanagari is now detected at all.** The README advertises "Devanagari → Latin transliteration in the detection pipeline" and the pipeline diagram lists it as stage 4, but on a spot check of native-script spellings of the shipped `hi-latn` entries, **1 of 12 was detected**. Two independent defects, both in `transliterator.ts`: **(a)** `devanagariToLatin` emitted the inherent schwa that every bare Devanagari consonant carries, but Hindi does not pronounce most of them — चूत romanized to `choota` rather than `choot`, गांड to `gaanda`, भेनचोद to `bhenachoda`, मादरचोद to `maadarachoda`. None of those spellings is a dictionary key, so the lookup could not succeed. Schwa deletion is now applied: word-final schwa always drops, and medial schwa drops in Ohala's `V C _ C V` environment, evaluated right-to-left, with a schwa carrying a nasal coda protected. **(b)** `transliterate` applied the Hinglish folds to the *original* string rather than to the romanized output; being Latin-only regexes they matched nothing against Devanagari, so a native-script word only ever reached the dictionary via its unfolded romanization — गांडू produced `gaandoo` but never `gaandu`, which is the spelling the dictionary lists. The folds now run on the romanization. Additionally, the retroflex flaps ड़/ढ़ are emitted in both their readings (strictly `r`-like, but Hinglish spells them `d` far more often — भोसड़ीके is written "bhosdike"), and the fully-voweled romanization is **no longer** generated: it is not Hindi but the raw glyph sequence, and it manufactured profanity from ordinary words — साल ("year") read as `saala`, the insult, and दाल ("lentil") as `daala` → `dala`. Native-script recall goes from 1/12 on the spot check to **38/38** across every shipped `hi-latn` entry, with 200/200 benign Hindi inputs clean.

- **Both safelists now apply to Devanagari input.** The internal safelist and the caller's `whitelist` are keyed by surface form, so a Devanagari token was *matched* on its romanization but *safelist-checked* on its original script — the check could never hit. गंध ("smell") romanizes to `gandh`, which is safelisted, and was still reported as the high-severity `gaand`; likewise शाला ("school") → `shaala` and छूट ("discount") → `chhoot`, so _"इस दुकान पर पचास प्रतिशत छूट है"_ ("50% off at this shop") was high-severity profanity. Both safelists are now also consulted against the romanized forms. Only the faithful romanizations are used, never the Hinglish folds — the folds are lossy, so letting a folded skeleton match the safelist would allow one benign word to exempt every profanity that collapses onto it. The check runs *after* the Tier 1 exact lookup, so a dictionary entry listed in native script can never be silenced by a benign Roman word that happens to share its romanization. Callers benefit directly: `whitelist: ['chhoot']` now covers छूट.

- **The phrase tier now folds spellings, reaches Devanagari, and honours the whitelist.** `matchPhrases` did a single `normalize()` lookup and nothing else, which left three holes. **(a)** Hinglish phrases matched only on the exact spelling stored in the dictionary — even though the entire reason the phonetic folds exist is that Hinglish has no standard spelling — so `teri maa kee` and `maa kee aankh` missed while `teri maa ki` and `maa ki aankh` hit. **(b)** A phrase written in Devanagari shares no surface form with its Roman key, so none of the 13 Hinglish phrase entries was reachable in native script; `चुप कर` and `तेरी माँ की` went undetected. **(c)** No whitelist was consulted at any point, so `whitelist: ['shut up']` could not suppress a phrase entry — despite the README presenting the whitelist as the integration-time escape hatch for exactly this. A second phrase index keyed on the folded form now backs the exact one, and both sides are folded identically (folding only the input takes `teri maa kee` to `terimaki` while the stored key is still `terimaaki`). Folded matches report confidence `0.9`, matching the word-level transliteration tier, and are scoped to `hi-latn` for the same reason that tier is. The whitelist is checked against both the surface form and the normalized key.

- **Chandrabindu is read positionally.** The nasal mark ँ marks a nasalized vowel rather than a nasal consonant, and Hinglish is split on it — आँख is written "aankh" but माँ is written "maa", never "maan". The split is positional: the `n` is written when a consonant follows inside the same word and dropped at the end of one. Writing it unconditionally broke any phrase needing one of each, which `माँ की आँख` does. Both fixed readings are still generated as variants for spellings that ignore the convention. Anusvara ं is deliberately not configurable — before a consonant it is a real nasal, and dropping it would turn गांड into "gaad".

- **Precomposed nuqta consonants are no longer dropped.** The nuqta letters (क़ ख़ ग़ ज़ ड़ ढ़ फ़ य़, plus ऩ/ऱ/ऴ) exist in two encodings: a single precomposed codepoint (U+0958–U+095F) and base letter + U+093C. Unicode lists the precomposed forms as composition exclusions, so NFC and NFKC *decompose* them — which is why the literal keys in `CONSONANTS` are the two-codepoint pairs. Precomposed input matched none of them, fell through every branch of the parser, and was discarded without a trace: ज़ simply vanished, turning हरामज़ादा into `haraamaadaa`. `detect()` masked the bug because `unicodeFold` runs NFKC before tokenizing, but `devanagariToLatin` was wrong for any caller reaching it directly, and the pipeline should not have depended on an unrelated stage for correctness. The precomposed codepoints are now mapped explicitly. Because the two encodings are visually identical in every editor, `tests/devanagari.test.ts` asserts that both romanize the same — that assertion is what will catch the file being re-saved under NFC normalization, which would silently collapse the new keys into duplicates and restore the bug.

- **`bahanchod` and its spellings added to `bhenchod`; `लंड` added natively to `lund`.** बहनचोद romanizes correctly to `bahanchod` (बहन = sister), which was not a listed spelling — `bahanchod`, `behanchod`, `behenchod` and `bahenchod` are now aliases, and none collides with a word in any shipped language. `लंड` is listed in Devanagari because it is the one entry whose correct romanization is unusable as a key: it reads `land`, and adding that as a Roman alias would flag the English word. Devanagari strings cannot collide with any shipped language, so matching it at Tier 1 is exact and risk-free.

- **`sale` no longer flagged as the Hinglish insult `saala`.** `sale` was listed as an alias of `saala` (category `insult`, severity `medium`), so with the default all-languages config every ordinary commerce message — _"50% off sale"_, _"sale price"_, _"end of season sales"_ — was reported as profanity. This is the single highest-volume false positive in the package for its stated call-centre and customer-communication use case. The alias is removed; the canonical `saala` and the genuine Hinglish spellings `saale`, `sali`, `saali` are unaffected and still detected. `sale`/`sales` were additionally added to the `en` safelist bucket as cover against fuzzy collisions.

- **`con` and `cons` no longer flagged as the French insult `con`.** The French entry `con` (category `insult`, severity **`high`**) and its `normalized` plural `cons` are spelled identically to two everyday English words, so _"let us weigh the pros and cons"_ and _"a con artist"_ were reported as high-severity abuse whenever the French pack was loaded — which is the default. Both spellings are now in the `en` safelist bucket. Because the safelist is language-scoped (see above), this is **not** the blanket suppression that the `bite` fix in 1.0.14 required: `createInstance({ languages: ['fr'] })` still detects the French word at full severity, with unchanged positions and obfuscation handling. The same scoping retroactively lifts the 1.0.14 `bite` trade-off.

- **`haji` removed from the English slur corpus.** The entry (category `slur`, severity `high`, aliases `hadji`, `hajji`, `hajis`) was added for the pejorative military-slang sense, but the dominant sense of the spelling is the honorific for someone who has performed Hajj, and it is a very common given name and form of address — so `Haji`, `Haji Ali Dargah`, and `Haji Muhammad sahib` were all reported as high-severity slurs. The matcher is context-blind at single-token granularity and cannot separate the two senses, and the honorific sense is far more frequent. The entry also contradicted the safelist, which already listed `hajji` as a religious term: the safelist is consulted first, so that alias was dead while `hadji` still fired. The whole family (`hajj`, `hajji`, `hadj`, `hadji`, `haji`, `hajis`, `hajjis`) is now safelisted and covered by the false-positive corpus.

### Added

- **`scripts/audit-hinglish-fp.mjs` — false-positive audit over romanized Hindi/Urdu.** Both existing audits (`audit-fuzzy-fp.js`, `audit-all-fp.js`) scan an *English* wordlist and were therefore structurally blind to the class above: a benign Hinglish word that the phonetic folds collapse onto a profanity root. `dikhai` could never have surfaced, because it is not an English word. No published wordlist of romanized Hindi exists, so the script carries a hand-built 476-word corpus of everyday vocabulary — verb inflections, kinship terms, numbers, time and question words, pronouns — weighted toward the digraphs the folds actually rewrite (`kh`, `gh`, `bh`, `dh`, `th`, `sh`, `ph`, `ch`) and the vowel clusters they collapse (`aa`, `ee`, `oo`, `ai`, `au`), plus Indian proper nouns and surnames that brush the same rules. It also carries a cross-language control set (`pushy`, `nigh`, `theta`, `jeez`, `cools`, …) that is clean only while the transliteration tier stays scoped, so widening the tier lights these up first. Not shipped in the package; run with `node scripts/audit-hinglish-fp.mjs`.

- **`scripts/audit-devanagari.mjs` — native-script audit, both directions.** Recall over every shipped `hi-latn` entry spelled in Devanagari, and precision over a 200-entry corpus of everyday Hindi (greetings, kinship, body, time, place, food, verbs, adjectives, question words, festivals, numbers, and running prose). Schwa deletion *widens* what the romanizer produces, so it could only ship alongside a false-positive corpus. Not shipped in the package; run with `node scripts/audit-devanagari.mjs`.

### Tests

- New [`tests/devanagari.test.ts`](./tests/devanagari.test.ts) (94 assertions): schwa-deletion romanizations asserted individually (including the `साल` → `saal` / `दाल` → `daal` cases that must not gain a vowel, and the single-syllable and nasal-coda guards); both retroflex-flap readings; a regression test that the Hinglish folds reach the romanized form; native-script recall over every `hi-latn` entry; position mapping back to the original string and Devanagari embedded in Latin text; the safelist-via-romanization path, including that it uses faithful romanizations only (छूट exempt, चूत still flagged) and that a natively-listed entry outranks the exemption; and the precomposed/decomposed nuqta equivalence guard.

### Performance

- **Net throughput is unchanged** — 2128 → 2188 ops/sec on `scripts/perf-probe.mjs` (median of five runs each), i.e. marginally faster than before despite the added work. Two costs were introduced and both were paid back:
  - The Devanagari safelist check runs `hasDevanagari` per token. That function was rewritten from a regex to a charCode scan, which more than covers it.
  - The phrase tier's folded lookup initially cost ~45%, because it re-folded every n-gram window from scratch — which made phrase matching the single most expensive stage in `detect()`. Fixed by folding per *word* instead of per phrase (sound, because `transliterate` runs before `normalize` strips the spaces, so no fold ever spanned a word boundary), memoizing each token's fold across the overlapping windows it appears in, gating on window width before folding anything, and dropping a redundant `normalize` from the folded key — obfuscation is already handled by the exact phrase index, which is consulted first on the same window.
  - `hinglishFold` gained an exact-equivalence fast path: one combined regex test replaces thirteen global replaces when no rule's pattern is present, in which case every replace is provably a no-op. This runs per token on every call and is what puts the net figure slightly ahead.

- [`tests/transliteration-scope.test.ts`](./tests/transliteration-scope.test.ts) gains a **Phrase tier** group: a Hinglish phrase matched across spellings, whitelist suppression of a phrase entry, the folded phrase index staying scoped to `hi-latn` (`sut up` must not reach the English `shut up`), and benign multi-word Hindi in both scripts staying clean. [`tests/devanagari.test.ts`](./tests/devanagari.test.ts) gains native-script phrase recall and the reduced-confidence assertion.

- New [`tests/transliteration-scope.test.ts`](./tests/transliteration-scope.test.ts) (61 assertions): the reported `dikhai` regression in isolation and in running Hindi prose; the twenty-word cross-language fold corpus, each annotated with the fold that used to produce the hit; the `hi-latn` safelist entries and the compounds that must stay clean *without* being safelisted; a guard that safelisting has not shielded the real roots; the language-scoping trade for `phool`; a property check that no fold-only input can return a non-`hi-latn` match; and the differential invariant that the transliteration tier adds no coverage of its own over any dictionary surface form — the assertion that makes the scoping provably free.

### Docs

- README English coverage table updated: total word count 523 → 519, and "Call-centre abuse vocabulary" 21 → 17. Added a note under **Use Cases → Call-centre and customer support** explaining why the crime/report nouns are intentionally not treated as profanity.

- **README dictionary counts corrected against the shipped packs.** The stated totals had drifted from the source: the overall figure read 746 words where the packs hold **741**, and the English section read 519 where it holds **518** (the 519 recorded in the entry above was itself one too many). Verified by counting `getWords(null)` / `getPhrases(null)` directly; per-language figures for Hinglish (32/13), Spanish (80/17), French (54/13), and German (57/9) were already correct, and the phrase total of 127 is unchanged.

- **README documents native Devanagari support.** The capability table previously folded Devanagari into the row for "Hindi and Urdu written in Latin script"; native-script input now has its own row naming what it actually does (schwa deletion, both retroflex-flap readings, both nuqta encodings) and stating plainly that Urdu in Arabic script is **not** covered. The Hinglish coverage section gains a paragraph on native-script reach, the pipeline diagram's transliteration stage notes schwa deletion and its scoping to the Hinglish dictionary, and a new **Hindi Corpora** subsection under Testing records the two audits and why the English-wordlist corpus could not have surfaced their findings. The *Scope* note under Substring-Collision Resistance now distinguishes the fold collisions that are closed structurally from those still neutralised by safelist.

---

## [1.0.14] — 2026-05-17

### Fixed

- **Cross-language exact-collision false positives on the everyday English words `bite` and `bites`.** With all language packs loaded (the default), the English tokens `bite` and `bites` matched the French entry `bite` (slang for penis, severity `high`, category `sexual`) — `bites` via the plural listed in that entry's `normalized` array, `bite` via the canonical word — so ordinary English text such as _"a snake bite"_ or _"the dog bites"_ was reported as high-severity sexual profanity. Both spellings, with their benign inflections, are now in the internal safelist (`SAFE_WORDS`), which is consulted before every match tier in both `matchToken` and `matchRawSegment`. Trade-off, documented inline: the French canonical word `bite` is no longer detected even in genuine French text, but its obfuscated alias forms (`bitte`, `bittes`, `b1te`) remain detectable, so deliberate evasion is still caught.
- **Transliteration-fold false positive on `smooth`.** The transliterator's Hindi-romanization vowel fold `oo → u` is applied to all Latin input, not only Devanagari-sourced text, so `smooth` produced the variant `smut`, which exact-matched the English `smut` entry (severity `low`, category `sexual`) at the transliteration tier. `smooth` and its inflections (`smoothly`, `smoothie`, `smoothies`, `smoothing`) are now safelisted. The fold itself is unchanged because it is load-bearing for genuine Hindi-Latin variants (for example `choot` → `chut`), which continue to be detected.
- **Aggressive-normalization collisions on common English words, surfaced by a new broad audit.** The repeated-letter collapse (`oo → o`) and vowel folds collapsed several everyday words onto short profanity roots and aliases. The most damaging was `cook` / `kook` collapsing to `cok`, an alias of `cock` (severity **`high`**) — so text such as _"I love cooking"_ scored as severe profanity. Also fixed: `hail` and `heel` → `hell`, `shale` → Hindi-Latin `saala`, `brawler` → French `branler`, and `booboo` → Spanish `bobo`. These words and their benign inflections are now safelisted; the collapse/fold rules remain unchanged because they are required for obfuscation detection. The canonical profane forms (`cock`, `hell`, `saala`, `branler`, `bobo`) and their obfuscated variants are unaffected and still detected.

### Added

- **`scripts/audit-all-fp.js` — broad false-positive audit.** The existing `scripts/audit-fuzzy-fp.js` only inspects results where `matchType === 'fuzzy'` and `language === 'en'`, and so was structurally blind to the cross-language exact-match and normalization/transliteration-fold false-positive classes above. The new script sweeps every English word in the wordlist across all match types and all languages, filters out genuine inflections (where the matched root is a substring of the input), and groups the remaining suspicious clusters for triage. Not shipped in the package; run with `npm install --no-save an-array-of-english-words` then `node scripts/audit-all-fp.js`.

### Tests

- The substring-collision regression corpus in [`tests/false-positives.test.ts`](./tests/false-positives.test.ts) gains a dedicated `crossLangAndFoldCollisions` group (36 inputs) exercising the new safelist entries, plus assertions that the canonical profane forms (`smut`, `cock`, `hell`, `bitte`, `saala`, `bobo`) are still caught. README substring-collision corpus total updated 485 → 521 accordingly.

---

## [1.0.13] — 2026-05-13

### Fixed

- **Fuzzy false positives on benign English words one edit from a dictionary entry.** A batch of real, never-profane words surfaced by `scripts/audit-fuzzy-fp.js` — including `aspirate`/`aspirated`/`aspirates`/`aspirating`/`aspiration` (≠ _asspirate_), `creatin`/`creatine` (≠ _cretin_), `pargasite`/`parakite` (≠ _parasite_), `belled` (≠ _bellend_), `pithead` (≠ _pinhead_), `revoting` (≠ _revolting_), `conchie` (≠ _coochie_), `silkening` (≠ _sickening_), `inferiors`, `eradiate`, `revulsive`, `despicably`, `degenerated`, and the ubiquitous UI term `toolbar`/`toolbars` (≠ _toolbag_) — were each within one edit (similarity ≥ 0.85) of a dictionary entry and so fuzzy-matched. All are now in the internal safelist; the canonical profane forms and their own inflections remain detectable.

### Tests

- False-positive regression corpus expanded by 17 fuzzy near-collision inputs (348 → 365 fuzzy, 468 → 485 total) so every new safelist entry is exercised on each run; README substring-collision table updated to match.

---

## [1.0.12] — 2026-05-09

### Fixed

- **Boundary punctuation decoded into profanity via the leet table.** Raw segments were normalized without first stripping structural boundary punctuation, but several such characters are themselves leet-substitution sources: the bracket openers `(` `[` `{` `<` all map to `c`, and `#` maps to `h`. As a result a parenthetical like `(on` decoded to `con` (a French high-severity insult) and a hashtag like `#oe` decoded to `hoe`. A new `stripBoundaryPunct()` pass removes brackets, quotes, sentence punctuation, and the `#` prefix symmetrically from both edges of a raw segment before normalization, narrowing result positions to the inner span. Genuine obfuscation characters (`@`, `$`, `|`, `!`, `+`, `*`, `^`) and digits are deliberately **not** stripped, so leet forms such as `@$$hole`, `$lut`, `|=uck`, and `5lut` continue to match.
- **`slt` removed as an alias of `slut`.** `slt` is the most common French SMS shorthand for _salut_ ("hi"); its benign volume vastly exceeds chat-shorthand use as _slut_, so the alias produced more false positives than true detections.

### Added

- **`scripts/test-ddos.mjs` — hands-on DoS / crash verification harness.** Exercises the input-boundary and repetition-collapse hardening from 1.0.11 against the local build, optionally diffing behaviour against the last pre-fix npm release (`--remote`, `verlux@1.0.10`). Each vector prints what the attacker sends and what the old versus current version does; a vector is "closed" when the current version throws cleanly or completes within a small time budget. Not shipped in the package.

### Tests

- Added [`tests/boundary-strip.test.ts`](./tests/boundary-strip.test.ts) covering the new boundary-punctuation strip across brackets, quotes, hashtags, transposed punctuation, and the preserved-leet-character cases.

---

## [1.0.11] — 2026-05-07

### Security

- **Input boundary hardened across `detect`, `score`, `censor`, and `isClean`.** Non-string `text` arguments — numbers, booleans, plain objects, arrays, symbols, BigInts, `null`, and `undefined` — previously crashed inside the matching pipeline with `TypeError: text.trim is not a function`, or, in the case of objects whose duck-typed `trim` returned a length-bearing value, surfaced as `RangeError: Invalid array length` from `unicodeFold`. Each of the four public methods now validates `text` at the API boundary via a single `validateInputText()` helper and throws `TypeError: verlux: text must be a string (got <type>)` before any matcher state is touched. This closes a class of crashes that any HTTP integration piping `req.body.message`-style values directly into Verlux was previously exposed to.
- **Hard 100,000-character cap on `text` inputs.** Previously, a single non-whitespace token of roughly four million or more identical characters caused V8's Irregexp engine to overflow its internal stack inside the normalizer's repetition-collapse pass (`/(.)\1{2,}/g`) — a remote denial-of-service vector reachable from any unguarded `verlux.detect()` caller, for example via an HTTP request body containing `'a'.repeat(5_000_000)`. Inputs exceeding the cap now throw `RangeError: verlux: text exceeds maximum length of 100000 characters` at the API boundary. Realistic moderation inputs (chat messages, support tickets, forum posts) are well under this ceiling; consumers who scan longer documents should chunk the input.
- **Repetition-collapse normalizer rewritten without regex.** The two repetition-collapse passes in `normalize()` and `normalizeVariants()` now run as manual O(n) scans through a single `collapseRuns()` helper rather than as `String.prototype.replace` calls against `/(.)\1{2,}/g` and `/(.)\1+/g`. Together with the input cap, this removes the V8 regex-engine stack-overflow vector at its root, regardless of how the text reaches the normalizer. Newline-like characters (`\n`, `\r`, U+2028, U+2029) are deliberately preserved so the new helper matches the original `(.)`-without-`s`-flag semantics exactly; all 776 existing detection tests pass without modification.
- **`censor()` mask coerced safely to a string.** A non-string `mask` value (for example `verlux.censor(text, { mask: 1234 })`) previously crashed at `mask.repeat(...)` with `TypeError: mask.repeat is not a function`. The mask now silently defaults to `'*'` whenever the supplied value is not a string, matching the documented "configurable mask character" contract.
- **Whitelist entries validated as strings at configuration time.** A `whitelist` array containing a poisoned object whose `toString` throws (`{ toString() { throw new Error('pwn') } }`) previously propagated the arbitrary thrown error out of `detect()` through the defensive `String(w)` coercion in `resolveConfig`. The whitelist array is now validated element-by-element by `validateConfig`, and any non-string entry is rejected with `TypeError: verlux: whitelist[i] must be a string (got <type>)` before configuration is resolved. The defensive `String(w)` coercion has been removed accordingly.
- **Per-call `languages` configuration no longer rebuilds the dictionary index on every call.** Previously, any caller forwarding user-controlled language preferences — for example `verlux.detect(text, { languages: req.body.langs })` — paid the full cost of `buildIndex(...)` on every invocation, measured at approximately 70× CPU amplification on a hot path (1,070 ms versus 15 ms for one thousand calls of an eleven-character input). A cache keyed on the sorted language set now reuses prior builds; cache size is bounded by the powerset of the supported language list and so cannot grow unbounded under adversarial input. Repeat-call latency drops to within noise of the no-config baseline.

### Changed

- `detect`, `score`, `censor`, and `isClean` now throw `TypeError` on non-string `text` inputs. Previously, falsy non-strings such as `null`, `undefined`, `0`, and `false` returned an empty result, while truthy non-strings crashed with cryptic internal errors. Empty and whitespace-only strings continue to short-circuit to the empty result as before. Callers who rely on the prior permissive behavior for nullish inputs should add an explicit `text != null` guard at the call site.

---

## [1.0.10] — 2026-05-06

### Added

- **Project governance and contributor documentation.** Added [`CHANGELOG.md`](./CHANGELOG.md) (this file) following the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format, [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md), [`CONTRIBUTING.md`](./CONTRIBUTING.md) describing the dictionary-submission and pull-request workflow, [`LICENSE`](./LICENSE) (MIT), and [`SECURITY.md`](./SECURITY.md) describing the private vulnerability-disclosure channel. These files codify the contribution and disclosure expectations that the project had been operating under informally.
- **Structured GitHub issue and pull-request templates.** Added [`.github/ISSUE_TEMPLATE/bug_report.yml`](./.github/ISSUE_TEMPLATE/bug_report.yml), [`false_positive.yml`](./.github/ISSUE_TEMPLATE/false_positive.yml), [`missed_detection.yml`](./.github/ISSUE_TEMPLATE/missed_detection.yml), and [`feature_request.yml`](./.github/ISSUE_TEMPLATE/feature_request.yml), together with [`config.yml`](./.github/ISSUE_TEMPLATE/config.yml) routing other questions to GitHub Discussions, and a [`PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md). The four issue templates correspond to the principal classes of report Verlux receives — crashes, false positives, missed detections, and feature proposals — and surface the metadata each class needs (input string, expected versus actual behaviour, language pack, severity tier) without requiring reporters to discover those fields themselves.

### Changed

- **Readme rewritten with expanded coverage of detection capabilities, comparison data, and benchmark methodology.** The substring-collision-resistance and Unicode-obfuscation-resistance sections were elaborated, the comparison against the three most-downloaded npm profanity packages (`bad-words`, `obscenity`, `@2toad/profanity`) was added, and the data-sources / attribution and notice-and-intended-use sections were restructured to match the language now codified in [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`SECURITY.md`](./SECURITY.md).

---

## [1.0.9] — 2026-05-05

### Added

- Substantial expansion of the English dictionary, including additional fuzzy-matching variants and category coverage. The expansion is paired with parallel updates to the matcher and tokenizer so that the new entries interact correctly with separator stripping, repetition collapse, and the substring-collision safelist.
- Tokenizer and matcher refinements that improve handling of edge inputs (snake_case identifiers, mixed punctuation runs) so that incidental occurrences of dictionary forms inside identifiers or code-like text no longer surface as detections.

### Changed

- Hinglish dictionary tweaks for spelling-variant coverage on common romanizations.

### CI

- `github/codeql-action` bumped from 4.35.2 to 4.35.3 ([#32](https://github.com/cwit-ae/Verlux/pull/32)).

---

## [1.0.8] — 2026-04-30

### Added

- **Unicode obfuscation handling.** A new front-of-pipeline `unicodeFold()` pass folds Cyrillic and Greek codepoints that visually impersonate Latin letters (for example `fuсk` written with Cyrillic U+0441 in place of Latin `c`), applies NFKC compatibility decomposition for fullwidth (`Ｆｕｃｋ`), mathematical-alphanumeric (`𝐟𝐮𝐜𝐤`), and ligature (`ﬁ`) forms, strips invisible / zero-width codepoints, and drops orphan combining marks (for example the strikethrough overlay in `f̸u̸c̸k̸`) before tokenization. Result `position` indices are mapped back through the fold's index map so `original`, position ranges, and `verlux.censor()` continue to operate on the input as the user typed it — including across UTF-16 surrogate pairs and one-to-many NFKC expansions. Pure-ASCII input takes a fast path that skips the per-codepoint loop entirely.
- A dedicated 296-line test suite at [`tests/unicode-obfuscation.test.ts`](./tests/unicode-obfuscation.test.ts) covering Cyrillic / Greek confusables, fullwidth and mathematical-alphanumeric NFKC folds, surrogate-pair-safe position mapping, combining-mark obfuscation (single overlays and stacked diacritics), preservation of legitimate precomposed Latin diacritics in Spanish / French / German entries, and non-flagging of legitimate Russian and Greek text that happens to fold to Latin letters but does not form a dictionary entry.

### Added (English dictionary)

- Additional safe-word entries to harden the substring-collision corpus against newly identified near-collisions surfaced during obfuscation testing.

---

## [1.0.7] — 2026-04-29

### Added

- New fuzzy-matching variants in the English dictionary, broadening coverage of common misspellings without lowering the global fuzzy threshold.
- Additional English safe words, paired with regression tests in the false-positive corpus.

---

## [1.0.6] — 2026-04-24

### Changed

- Substring-collision matcher hardened with additional internal safelist coverage. Matched by an expansion of the false-positive regression corpus so the new safelist entries are exercised on every test run.

---

## [1.0.5] — 2026-04-24

### Changed

- Safe-words list expanded to cover additional near-collisions identified during regression testing — reduces false positives on benign inputs whose surface forms incidentally contain a profane substring (the classical _Scunthorpe_ class of failures).

---

## [1.0.4] — 2026-04-24

### Fixed

- Skip l33t decoding for pure-digit tokens. Previously, single-character substitutions in the leet table (for example `4 → a`, `2 → z`) would decode pure-digit tokens such as `"422"` or `"1337"` into hallucinated dictionary matches. Pure-digit tokens now bypass the leet decode path entirely, eliminating an entire class of false positives on numeric input (timestamps, identifiers, version numbers, ZIP codes).

---

## [1.0.3] — 2026-04-22

### Added

- **French language pack** — 632-line dictionary covering metropolitan French invective and Franco-Arabic (banlieue) slang, with apostrophe-aware tokenization for grammatical elisions (so the meaningful word is matched regardless of the elision prefix), accent-aware matching for standard accented forms (`é`, `è`, `ê`, `à`, `ç`, `ï`, `ô`), and a French-specific false-positive safelist for short high-collision roots gated with `allowPartialMatch: false`.
- **German language pack** — 623-line dictionary covering standard High German invective with full umlaut handling. Every umlaut-bearing entry is listed in three input forms — canonical (`ä`, `ö`, `ü`, `ß`), accent-stripped (`a`, `o`, `u`, `ss`), and ASCII digraph (`ae`, `oe`, `ue`, `ss`) — so all three render forms are matched after normalization.
- Tokenizer and matcher updates required to thread the new language packs through the existing detection pipeline.
- Per-language test suites: [`tests/french.test.ts`](./tests/french.test.ts) (142 lines) and [`tests/german.test.ts`](./tests/german.test.ts) (135 lines).

### Changed

- English dictionary updated alongside the new language packs (+106 lines), primarily to extend safe-word coverage where the new packs introduced additional collision surface.

---

## [1.0.2] — 2026-04-21

### Changed

- npm publish workflow switched to OIDC trusted publishing (no long-lived npm token in CI) ([#11](https://github.com/cwit-ae/Verlux/pull/11)).
- npm version upgraded inside the publish workflow so OIDC trusted publishing succeeds on Node 22+ runners ([#12](https://github.com/cwit-ae/Verlux/pull/12), [#13](https://github.com/cwit-ae/Verlux/pull/13)).

### Fixed

- Publish workflow compatibility on Node 24 runners ([#15](https://github.com/cwit-ae/Verlux/pull/15)).

---

## [1.0.1] — 2026-04-21

### Added

- README badges for CI status, CodeQL status, and weekly downloads ([#8](https://github.com/cwit-ae/Verlux/pull/8)).
- Dependabot configuration for the npm and GitHub Actions ecosystems ([#1](https://github.com/cwit-ae/Verlux/pull/1)).
- CodeQL workflow scaffolding for static-analysis security scanning ([#6](https://github.com/cwit-ae/Verlux/pull/6), [#7](https://github.com/cwit-ae/Verlux/pull/7)).

### Fixed

- Indentation correction in word-rendering output and removal of an unused import in the test files ([#9](https://github.com/cwit-ae/Verlux/pull/9)).

---

## [1.0.0] — 2026-04-21

### Added

- Initial public release.
- Detection pipeline with tokenization, exact match, normalized match (leet decoding, accent stripping, repetition collapse, separator stripping), Devanagari-to-Latin transliteration, Aho–Corasick partial-match scan, Levenshtein-based fuzzy match, n-gram phrase detection, and overlap deduplication.
- Three language packs out of the box: English, Hinglish (Hindi in Latin script), and Spanish (peninsular and major Latin American variants).
- Public API: `verlux.detect`, `verlux.score`, `verlux.isClean`, `verlux.censor`, `verlux.configure`, `verlux.addWords`, `verlux.addPhrases`.
- Severity (`low` / `medium` / `high`) and category (`slur`, `sexual`, `insult`, `hate`, `threat`, `drug`, `other`) metadata on every detection.
- Toxicity scoring weighted by severity, normalized against token count, with a repetition-spam multiplier.
- ESM and CommonJS dual builds with bundled TypeScript declarations. Zero runtime dependencies. Node.js ≥ 18 supported.

[Unreleased]: https://github.com/cwit-ae/Verlux/compare/v1.0.14...HEAD
[1.0.14]: https://github.com/cwit-ae/Verlux/compare/v1.0.13...v1.0.14
[1.0.13]: https://github.com/cwit-ae/Verlux/compare/v1.0.12...v1.0.13
[1.0.12]: https://github.com/cwit-ae/Verlux/compare/v1.0.11...v1.0.12
[1.0.11]: https://github.com/cwit-ae/Verlux/compare/v1.0.10...v1.0.11
[1.0.10]: https://github.com/cwit-ae/Verlux/compare/v1.0.9...v1.0.10
[1.0.9]: https://github.com/cwit-ae/Verlux/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/cwit-ae/Verlux/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/cwit-ae/Verlux/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/cwit-ae/Verlux/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/cwit-ae/Verlux/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/cwit-ae/Verlux/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/cwit-ae/Verlux/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/cwit-ae/Verlux/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/cwit-ae/Verlux/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/cwit-ae/Verlux/releases/tag/v1.0.0

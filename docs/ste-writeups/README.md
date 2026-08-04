# STE-strict project writeups

These are the **ASD-STE100 (Simplified Technical English, Issue 4)** versions of the
four portfolio project writeups, produced with the installed `/ste-check` command.

They are kept here as a **reference / starting base for real technical documentation** —
they are *not* what the site ships. The live writeups in `src/content/writeups/` use a
livelier, less constrained voice that suits a hiring portfolio; these strict versions
trade voice for the controlled-language properties STE is built for (translatability,
unambiguous instructions, approved vocabulary only).

## Compliance status

- **Zero genuine vocabulary violations.** Every general non-approved word was rewritten
  against the approved Dictionary (each replacement checked before use).
- The ~26 residual flags the script still reports are all **STE-compliant**, not errors:
  - **Acronym** the script lowercases: `REST`.
  - **Approved Technical Verbs** (Rule 1.10): `save`, `drag`.
  - **Compound / domain Technical Names** (Rule 1.5): `run`-length, `brute-force`,
    `draw`-to-predict, BB84 quantum `key-distribution`, `cover letter`, unstructured
    `search`, `key exchange`, public `channel`, `zero`-backend.
  - **CHECK-POS words used in their approved part of speech** (Rule 1.2): `end`(n),
    `help`(v), `use`(v), `result`(n), `time`(n), `free`(adj), `code`(n), `test`(n),
    `light`(adj).
- Structure was also brought to STE: no list semicolons, no complex/perfect passives,
  no `-ing` verb forms, no contractions, descriptive sentences under 25 words.

## Re-check

```
awk -f .claude/ste-reference/ste-vocab.awk .claude/ste-reference/dictionary.tsv docs/ste-writeups/*.md
```

or run `/ste-check docs/ste-writeups/` for the full rule-referenced report.

The vocabulary extract is best-effort, not the official copyrighted Dictionary (Part 2) —
confirm any contractual use against a licensed copy of ASD-STE100.

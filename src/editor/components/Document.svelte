<script lang="ts">
  import { editor } from '../lib/store.svelte';
  import { typeDef, entryLead, hasBullets } from '../lib/section-types';
  import type { Section } from '../lib/types';

  const person = $derived(editor.person);
  const selEntry = $derived(editor.selection.kind === 'entry' ? editor.selection.entryId : null);

  function contactLine(): string {
    const p = person.personal;
    return [p.position, p.email, p.address, p.github && `github/${p.github}`].filter(Boolean).join(' · ');
  }
  function pick(sectionId: Section['id'], entryId: number) {
    editor.select({ kind: 'entry', sectionId, entryId });
  }
  function keyPick(e: KeyboardEvent, sectionId: Section['id'], entryId: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(sectionId, entryId);
    }
  }
</script>

<article class="doc">
  <header class="doc-head">
    <h1>{person.personal.firstName} {person.personal.lastName}</h1>
    <p class="contact">{contactLine()}</p>
  </header>

  {#each person.sections as section (section.id)}
    {@const def = typeDef(section.type)}
    <section class="sec">
      <div class="sec-head"><h2>{section.title}</h2><span class="sec-tools">＋&nbsp;&nbsp;⠿</span></div>

      {#if def?.isParagraph}
        <p class="para">{section.entries[0]?.fields.text ?? ''}</p>

      {:else if def?.latexType === 'cvskills'}
        {#each section.entries as e (e.id)}
          <div class="skill"><span class="skill-cat">{e.fields.category}</span><span>{e.fields.skills}</span></div>
        {/each}

      {:else if def?.latexType === 'cvhonors'}
        {#each section.entries as e (e.id)}
          <div class="entry" class:sel={selEntry === e.id} role="button" tabindex="0"
               onclick={() => pick(section.id, e.id)} onkeydown={(ev) => keyPick(ev, section.id, e.id)}>
            <div class="entry-line">
              <span class="entry-title">{[e.fields.award, e.fields.issuer].filter(Boolean).join(' · ')}</span>
              <span class="entry-date">{e.fields.date ?? ''}</span>
            </div>
          </div>
        {/each}

      {:else if def?.latexType === 'cvreferences'}
        {#each section.entries as e (e.id)}
          <div class="entry">
            <div class="entry-line"><span class="entry-title">{e.fields.name}</span><span class="entry-date">{e.fields.relation ?? ''}</span></div>
          </div>
        {/each}

      {:else}
        {#each section.entries as e (e.id)}
          <div class="entry" class:sel={selEntry === e.id} role="button" tabindex="0"
               onclick={() => pick(section.id, e.id)} onkeydown={(ev) => keyPick(ev, section.id, e.id)}>
            <div class="entry-line">
              <span class="entry-title">{[entryLead(section.type, e.fields), e.fields.organization].filter(Boolean).join(' · ')}</span>
              <span class="entry-date">{e.fields.date ?? ''}</span>
            </div>
            {#if hasBullets(section.type) && e.items.length}
              <ul>
                {#each e.items as it (it.id)}
                  <li>{#if it.title}<b>{it.title}</b> — {/if}{it.content}{#each it.tags as t}<span class="tag">#{t}</span>{/each}</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/each}
      {/if}
    </section>
  {/each}

  <button class="add-section">＋ Add section · Roles / Achievements / Other</button>
</article>

<style>
  .doc { font-family: var(--serif); max-width: 640px; margin: 0 auto; padding: 40px 46px 54px; color: #232220; }
  .doc-head h1 { font-size: 30px; font-weight: 700; margin: 0 0 4px; }
  .contact { font-size: 13.5px; color: #55534e; margin: 0; }
  .sec { margin-top: 28px; border-top: 1px solid #d9d7cf; padding-top: 15px; }
  .sec-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .sec-head h2 { font-family: var(--sans); font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #3a3934; margin: 0; }
  .sec-tools { font-family: var(--sans); font-size: 13px; color: var(--dim); opacity: 0; }
  .sec:hover .sec-tools { opacity: 1; }
  .para { font-size: 14px; line-height: 1.55; margin: 0; }
  .skill { display: grid; grid-template-columns: 132px 1fr; gap: 12px; font-size: 14px; margin: 4px 0; }
  .skill-cat { font-weight: 700; }
  .entry { padding: 9px 10px; margin: 2px -10px; border: 1px solid transparent; border-radius: 6px; cursor: pointer; }
  .entry:hover { border-color: #e2e0d8; background: #faf9f3; }
  .entry.sel { border-color: var(--ink); background: var(--paper); box-shadow: var(--shadow); }
  .entry:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }
  .entry-line { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; }
  .entry-title { font-size: 15px; font-weight: 600; }
  .entry-date { font-family: var(--mono); font-size: 12px; color: #55534e; white-space: nowrap; font-variant-numeric: tabular-nums; }
  ul { margin: 6px 0 0; padding-left: 20px; }
  li { font-size: 14px; line-height: 1.55; margin: 3px 0; }
  .tag { font-family: var(--mono); font-size: 11px; color: var(--dim); margin-left: 6px; }
  .add-section { margin-top: 22px; font-family: var(--sans); font-size: 12.5px; color: #55534e; background: none; border: 1px dashed var(--dim); border-radius: 6px; padding: 7px 12px; cursor: pointer; width: 100%; }
</style>

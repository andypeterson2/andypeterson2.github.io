// The tag-suggestion concern: fetch suggestions for an entry or bullet after the
// author pauses, show the top few beside its chips, and report what they do with
// them (accept, dismiss, type a tag by hand, remove one) so the backend can
// measure how suggestion is doing. Suggestions are only ever applied by a click.

import { api, type TagEvent, type TagSuggestion } from './api';
import type { TagController } from './tags.svelte';
import type { Entry, Item } from './types';

export type SuggestKind = 'entry' | 'item';
type Target = Entry | Item;

export interface SuggestHost {
  connected(): boolean;
  activePersonId(): number | null;
}

/** Suggestions shown per entry or bullet. */
export const SHOWN = 3;
/** Ranked tags fetched, so enough remain after dropping ones already applied. */
const FETCHED = 8;

/** Client mirror of the backend's tag canonicalization, for comparing tags. */
export function canonicalTag(tag: string): string {
  return tag
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const key = (kind: SuggestKind, id: number) => `${kind}:${id}`;

export class SuggestionController {
  /** the suggestions on show, by `${kind}:${id}` */
  shown = $state<Record<string, TagSuggestion[]>>({});
  private dismissed = new Map<string, Set<string>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private latest = new Map<string, number>();
  private seq = 0;

  constructor(
    private host: SuggestHost,
    private tags: TagController,
    private delayMs = 700,
  ) {}

  for(kind: SuggestKind, id: number): TagSuggestion[] {
    return this.shown[key(kind, id)] ?? [];
  }

  /** Ask for suggestions once the author has paused on `text`. */
  request(kind: SuggestKind, target: Target, text: string) {
    const k = key(kind, target.id);
    clearTimeout(this.timers.get(k));
    this.timers.set(
      k,
      setTimeout(() => void this.fetch(kind, target, text), this.delayMs),
    );
  }

  private async fetch(kind: SuggestKind, target: Target, text: string) {
    const pid = this.host.activePersonId();
    const k = key(kind, target.id);
    if (!this.host.connected() || pid == null || !text.trim()) {
      this.shown[k] = [];
      return;
    }
    const mine = ++this.seq;
    this.latest.set(k, mine);
    const res = await api.suggestTags(pid, text, FETCHED);
    // A slower, older request must not overwrite a newer one's suggestions.
    if (this.latest.get(k) !== mine || !res.ok || !res.data) return;
    const applied = new Set(target.tags.map(canonicalTag));
    const dropped = this.dismissed.get(k) ?? new Set<string>();
    this.shown[k] = res.data.results
      .filter((s) => !applied.has(canonicalTag(s.tag)) && !dropped.has(s.tag))
      .slice(0, SHOWN);
  }

  async accept(kind: SuggestKind, target: Target, tag: string) {
    const hit = this.take(kind, target.id, tag);
    if (kind === 'entry') await this.tags.addToEntry(target as Entry, [tag]);
    else await this.tags.addToItem(target as Item, [tag]);
    this.log({ target: kind, id: target.id, tag, action: 'accept', ...hit });
  }

  dismiss(kind: SuggestKind, target: Target, tag: string) {
    const k = key(kind, target.id);
    const hit = this.take(kind, target.id, tag);
    const dropped = this.dismissed.get(k) ?? new Set<string>();
    dropped.add(tag);
    this.dismissed.set(k, dropped);
    this.log({ target: kind, id: target.id, tag, action: 'dismiss', ...hit });
  }

  /** A tag the author typed; its rank records whether it was on show. */
  manual(kind: SuggestKind, target: Target, tag: string) {
    const hit = this.take(kind, target.id, canonicalTag(tag));
    this.log({ target: kind, id: target.id, tag, action: 'manual', ...hit });
  }

  removed(kind: SuggestKind, target: Target, tag: string) {
    this.log({ target: kind, id: target.id, tag, action: 'remove' });
  }

  /** Remove a tag from the suggestions on show, returning where it was. */
  private take(kind: SuggestKind, id: number, tag: string) {
    const k = key(kind, id);
    const list = this.shown[k] ?? [];
    const rank = list.findIndex((s) => canonicalTag(s.tag) === canonicalTag(tag));
    if (rank < 0) return {};
    const [s] = list.splice(rank, 1);
    this.shown[k] = [...list];
    return { rank, score: s.score, scorer: 'embedding' as const };
  }

  private log(event: TagEvent) {
    const pid = this.host.activePersonId();
    if (!this.host.connected() || pid == null) return;
    void api.recordTagEvents(pid, [event]);
  }
}

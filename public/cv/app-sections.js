function appSections() {
  return {
    sections: [],
    docSections: [],

    // ------ Section CRUD ------

    async createNewSection() {
      const result = await this.openModal('New Section', [
        { name: 'title', label: 'Section title', value: '' },
        { name: 'type', label: 'Type (cventries, cvskills, cvhonors, cvreferences, cvparagraph)', value: 'cventries' },
      ]);
      if (!result || !result.title.trim()) return;
      const id = result.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!id) { console.error('Invalid title'); this.saveState = 'error'; return; }
      const type = result.type.trim();
      if (VALID_SECTION_TYPES.indexOf(type) === -1) { console.error('Invalid type'); this.saveState = 'error'; return; }
      const res = await cvApi.post(API.sections, { id: id, type: type, title: result.title.trim() });
      if (!res.ok) { console.error('Failed to create section'); this.saveState = 'error'; return; }
      await this.loadSections();
      const docSections = this.docSections.map(function(s) {
        return { sectionId: s.id, enabled: s.enabled, resumeParagraphText: s.resumeParagraphText || null };
      });
      docSections.push({ sectionId: id, enabled: true });
      await cvApi.put(API.documents('cv'), { sections: docSections });
      await this.loadDocumentSections('cv');
      this.saveState = 'saved';
    },

    async deleteSection(sectionId) {
      if (!confirm('Delete this section and all its entries?')) return;
      const res = await cvApi.del(API.section(sectionId));
      if (!res.ok) { console.error('Failed to delete'); this.saveState = 'error'; return; }
      await this.loadSections();
      await this.loadDocumentSections('cv');
      this.saveState = 'saved';
    },

    async renameSection(sectionId) {
      const sec = this.docSections.find(function(s) { return s.id === sectionId; });
      if (!sec) return;
      const result = await this.openModal('Rename Section', [
        { name: 'title', label: 'Section title', value: sec.title },
      ]);
      if (!result || !result.title.trim()) return;
      await this.saveSectionTitle(sectionId, result.title);
    },

    async saveSectionTitle(sectionId, newTitle) {
      const trimmed = newTitle.trim();
      if (!trimmed) return;
      const sec = this.docSections.find(function(s) { return s.id === sectionId; });
      if (sec && sec.title === trimmed) return;
      await cvApi.put(API.section(sectionId), { title: trimmed });
      if (sec) sec.title = trimmed;
    },

    // ------ Sections + Document config ------

    async loadSections() {
      const res = await cvApi.get(API.sections);
      if (!res.ok) return;
      this.sections = await res.json();
    },

    async loadDocumentSections(variant) {
      const res = await cvApi.get(API.documents(variant));
      if (!res.ok) return;
      const data = await res.json();
      this.docSections = [];
      for (const ds of data.sections) {
        const sec = this.sections.find(s => s.id === ds.sectionId);
        if (!sec) continue;
        this.docSections.push({
          ...sec,
          enabled: ds.enabled,
          resumeParagraphText: ds.resumeParagraphText,
          _expanded: true,
          _data: null,
        });
      }
      this.$nextTick(() => {
        for (const sec of this.docSections) {
          if (sec.enabled) this.loadSectionData(sec);
        }
      });
    },

    moveSection(index, dir) {
      const newIndex = index + dir;
      if (newIndex < 0 || newIndex >= this.docSections.length) return;
      const arr = [...this.docSections];
      [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
      this.docSections = arr;
      this.saveDocumentSections();
    },

    moveEntry(sec, index, dir) {
      if (!sec._data) return;
      const newIndex = index + dir;
      if (newIndex < 0 || newIndex >= sec._data.entries.length) return;
      const arr = [...sec._data.entries];
      [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
      sec._data.entries = arr;
      const ids = arr.map(e => e.id);
      cvApi.patch(API.sectionEntriesOrder(sec.id), { ids });
    },

    moveItem(entry, index, dir) {
      if (!entry || !entry.items) return;
      const newIndex = index + dir;
      if (newIndex < 0 || newIndex >= entry.items.length) return;
      const arr = [...entry.items];
      [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
      entry.items = arr;
      const ids = arr.map(i => i.id);
      cvApi.patch(API.entryItemsOrder(entry.id), { ids });
    },

    async saveDocumentSections() {
      const sections = this.docSections.map(s => ({
        sectionId: s.id,
        enabled: s.enabled,
        resumeParagraphText: s.resumeParagraphText || null,
      }));
      const variant = this.pdfTab === 'coverletter' ? 'cv' : this.pdfTab;
      await cvApi.put(API.documents(variant), { sections });
      this.saveState = 'saved';
    },

    toggleSection() {
      this.saveDocumentSections();
    },

    // ------ Section data (entries + items) ------

    async loadSectionData(sec) {
      if (sec._data) return;
      const res = await cvApi.get(API.section(sec.id));
      if (!res.ok) return;
      sec._data = await res.json();
      for (const entry of sec._data.entries) {
        entry._expanded = true;
        entry._editing = false;
        for (const item of entry.items) {
          item._expanded = true;
        }
      }
    },

    // ------ Entry CRUD ------

    autoSaveEntry(entry) {
      this.debounce('entry.' + entry.id, async () => {
        await cvApi.put(API.entry(entry.id), { fields: entry.fields });
        this.saveState = 'saved';
      });
    },

    async addEntry(sec) {
      const defaults = getDefaultFields(sec.type);
      const res = await cvApi.post(API.sectionEntries(sec.id), { fields: defaults });
      if (!res.ok) { console.error('Failed to add'); this.saveState = 'error'; return; }
      sec._data = null;
      await this.loadSectionData(sec);
    },

    async removeEntry(sec, entryId) {
      await cvApi.del(API.entry(entryId));
      sec._data.entries = sec._data.entries.filter(e => e.id !== entryId);
    },

    toggleResumeEntry(entry) {
      cvApi.put(API.entry(entry.id), { resumeIncluded: entry.resumeIncluded });
    },

    // ------ Item (bullet) CRUD ------

    autoSaveItem(item) {
      this.debounce('item.' + item.id, async () => {
        await cvApi.put(API.item(item.id), { content: item.content });
        this.saveState = 'saved';
      });
    },

    autoSaveItemTitle(item) {
      this.debounce('item.title.' + item.id, async () => {
        await cvApi.put(API.item(item.id), { title: item.title });
        this.saveState = 'saved';
      });
    },

    async addItem(entry) {
      const res = await cvApi.post(API.entryItems(entry.id), { content: '', title: '' });
      if (!res.ok) return;
      const data = await res.json();
      entry.items.push({ id: data.id, content: '', title: '', resumeIncluded: true, sort_order: entry.items.length, entry_id: entry.id, _expanded: true });
    },

    async removeItem(entry, itemId) {
      await cvApi.del(API.item(itemId));
      entry.items = entry.items.filter(i => i.id !== itemId);
    },

    toggleResumeItem(item) {
      cvApi.put(API.item(item.id), { resumeIncluded: item.resumeIncluded });
    },

    // ------ cvparagraph: autosave text + resume text ------

    autoSaveParagraph(sec) {
      const entry = sec._data.entries[0];
      if (!entry) return;
      this.debounce('para.' + entry.id, async () => {
        await cvApi.put(API.entry(entry.id), { fields: entry.fields });
        this.saveState = 'saved';
      });
    },

    autoSaveResumeParagraphText(sec) {
      this.debounce('rpt.' + sec.id, async () => {
        this.saveDocumentSections();
      });
    },
  };
}

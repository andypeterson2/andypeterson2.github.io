function appCoverletter() {
  return {
    coverletter: { settings: {}, sections: [] },

    async loadCoverletter() {
      const [settingsRes, sectionsRes] = await Promise.all([
        cvApi.get(API.settings + '?prefix=coverletter'),
        cvApi.get(API.coverletterSections),
      ]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        const s = {};
        for (const [key, value] of Object.entries(data)) {
          s[key.replace('coverletter.', '')] = value;
        }
        this.coverletter.settings = s;
      }
      if (sectionsRes.ok) {
        this.coverletter.sections = await sectionsRes.json();
      }
    },

    autoSaveCoverletterSetting(field) {
      this.debounce('cl.' + field, async () => {
        await cvApi.patch(API.settings, { ['coverletter.' + field]: this.coverletter.settings[field] || '' });
        this.saveState = 'saved';
      });
    },

    async addCoverletterSection() {
      const res = await cvApi.post(API.coverletterSections, { title: '', body: '' });
      if (!res.ok) return;
      const data = await res.json();
      this.coverletter.sections.push({ id: data.id, title: '', body: '', sort_order: this.coverletter.sections.length });
    },

    autoSaveCoverletterSection(sec) {
      this.debounce('clsec.' + sec.id, async () => {
        await cvApi.put(API.coverletterSection(sec.id), { title: sec.title, body: sec.body });
        this.saveState = 'saved';
      });
    },

    async removeCoverletterSection(secId) {
      await cvApi.del(API.coverletterSection(secId));
      this.coverletter.sections = this.coverletter.sections.filter(s => s.id !== secId);
    },
  };
}

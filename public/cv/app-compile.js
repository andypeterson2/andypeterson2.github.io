function appCompile() {
  return {
    compiling: false,
    compiledPdfs: { resume: '', cv: '', coverletter: '' },
    pdfUrl: '',

    switchPdfTab(name) {
      this.pdfTab = name;
      const labels = { cv: 'CV', resume: 'Resume', coverletter: 'Cover Letter' };
      const titleEl = document.querySelector('.cv-right-col .title');
      if (titleEl) titleEl.textContent = labels[name] || 'PDF';
      if (this.compiledPdfs[name]) {
        this.pdfUrl = this.compiledPdfs[name];
      } else {
        this.pdfUrl = '';
      }
    },

    async compile() {
      this.compiling = true;
      const name = this.pdfTab;
      try {
        const res = await cvApi.post(API.compile(name));
        const data = await res.json();
        if (data.success) {
          this.saveState = 'saved';
          const url = API_BASE + '/api' + API.pdf(name) + '?t=' + Date.now();
          this.compiledPdfs[name] = url;
          this.pdfUrl = url;
        } else {
          console.error('Compilation failed - check console'); this.saveState = 'error';
          console.error(data.log);
        }
      } catch (e) {
        console.error('Compilation error'); this.saveState = 'error';
      }
      this.compiling = false;
    },

    async save() {
      try {
        if (this.activePersonId) {
          const res = await cvApi.post(API.personSave(this.activePersonId));
          if (!res.ok) throw new Error('Save failed');
        }
        this.dirty = false;
        this.saveState = 'saved';
      } catch (e) {
        console.error('Save failed'); this.saveState = 'error';
      }
    },

    async exportData() {
      try {
        const res = await cvApi.get(API.export);
        if (!res.ok) throw new Error('Export failed');
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (this.personal.firstName || 'export') + '-cv-data.json';
        a.click();
        URL.revokeObjectURL(url);
        this.saveState = 'saved';
      } catch (e) {
        console.error('Export failed'); this.saveState = 'error';
      }
    },

    async importData() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          const res = await cvApi.post(API.import, data);
          if (!res.ok) throw new Error('Import failed');
          await this.init();
          this.saveState = 'saved';
        } catch (e) {
          console.error('Import failed: ' + e.message); this.saveState = 'error';
        }
      };
      input.click();
    },
  };
}

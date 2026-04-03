// JANE_DOE seed data loaded from /cv/seed-data.js
// Mixin functions loaded from /cv/app-*.js

function app() {
  const mixins = [
    appPersonal(),
    appStyle(),
    appSections(),
    appCoverletter(),
    appPersons(),
    appCompile(),
  ];

  const base = {
    editorTab: 'profile',
    pdfTab: 'cv',
    mobileView: 'editor',
    mobileFileMenu: false,
    saveState: 'disconnected',
    darkMode: true,
    dirty: false,
    serverConnected: false,
    isJaneDoe: false,
    _saveTimers: {},

    // Undo/redo state
    _undoStack: [],
    _redoStack: [],
    _maxUndoDepth: 100,
    _focusSnapshot: null,

    // Section collapse state
    _panels: {
      identity: true, contact: true, links: true,
      clRecipient: true, clDetails: true, clSections: true,
      stPage: true, stTypography: true, stAccent: true,
      stMargins: true, stHeaderSpacing: true, stSectionSpacing: true,
      stEntrySpacing: true, stBulletSpacing: true, stParagraphSpacing: true, stFontSizes: true,
    },

    // Modal state
    modal: { open: false, title: '', fields: [], resolve: null },

    async init() {
      this.darkMode = document.documentElement.dataset.theme !== 'light';
      if (!API_BASE) {
        this.loadDemo();
        return;
      }
      // Backend connected — load catalogs then data
      await this.loadCatalog();
      await Promise.all([
        this.loadPersonal(),
        this.loadSections(),
        this.loadCoverletter(),
        this.loadStyle(),
        this.loadSpacing(),
        this.loadFonts(),
        this.loadPersons(),
      ]);
      await this.loadDocumentSections('cv');
      this.serverConnected = true;
      this.saveState = 'saved';
      this.isJaneDoe = false;

      // Init resize handle
      this.$nextTick(() => {
        const handle = document.getElementById('resize-handle');
        const left = handle && handle.previousElementSibling;
        const container = handle && handle.parentElement;
        if (handle && left && container && window.UIKit && UIKit.initResize) {
          UIKit.initResize(handle, left, container, { min: 280, max: 800, default: 450, key: 'cv-editor-split' });
        }
      });

      // Warn before leaving with unsaved changes
      if (this._beforeUnloadFn) window.removeEventListener('beforeunload', this._beforeUnloadFn);
      const self = this;
      this._beforeUnloadFn = function(e) { if (self.dirty) { e.preventDefault(); e.returnValue = ''; } };
      window.addEventListener('beforeunload', this._beforeUnloadFn);
    },

    loadDemo() {
      this.personal = Object.assign({}, JANE_DOE.personal);
      this.sections = JANE_DOE.sections.map(function(s) {
        return { id: s.id, type: s.type, title: s.title };
      });
      this.docSections = [];
      for (let i = 0; i < JANE_DOE.documents.cv.length; i++) {
        const ds = JANE_DOE.documents.cv[i];
        const sec = JANE_DOE.sections.find(function(s) { return s.id === ds.sectionId; });
        if (!sec) continue;
        this.docSections.push({
          id: sec.id, type: sec.type, title: sec.title,
          enabled: ds.enabled,
          resumeParagraphText: ds.resumeParagraphText || null,
          _expanded: true,
          _data: { type: sec.type, entries: deepClone(sec.entries) },
        });
      }
      // Stamp _expanded on entries and items
      for (let j = 0; j < this.docSections.length; j++) {
        const d = this.docSections[j];
        if (!d._data) continue;
        for (let k = 0; k < d._data.entries.length; k++) {
          d._data.entries[k]._expanded = true;
          d._data.entries[k]._editing = false;
          const items = d._data.entries[k].items || [];
          for (let m = 0; m < items.length; m++) {
            items[m]._expanded = true;
          }
        }
      }
      this.coverletter = {
        settings: Object.assign({}, JANE_DOE.coverletter.settings),
        sections: deepClone(JANE_DOE.coverletter.sections),
      };
      this.persons = [{ id: 1, name: 'Jane Doe' }];
      this.activePersonId = 1;
      this.isJaneDoe = true;
      this.serverConnected = false;
      this.saveState = 'disconnected';
      this.dirty = false;
      this.loadIdentityExtras();
      this.loadPersonalLinks();
    },

    // ------ Expand / Collapse all ------

    expandAll() {
      this.docSections.forEach(s => {
        s._expanded = true;
        this.loadSectionData(s);
        if (s._data) s._data.entries.forEach(function(e) {
          e._expanded = true;
          e.items.forEach(function(i) { i._expanded = true; });
        });
      });
      for (let key in this._panels) {
        this._panels[key] = true;
      }
    },

    collapseAll() {
      this.docSections.forEach(function(s) {
        s._expanded = false;
        if (s._data) s._data.entries.forEach(function(e) {
          e._expanded = false;
          e.items.forEach(function(i) { i._expanded = false; });
        });
      });
      for (let key in this._panels) {
        this._panels[key] = false;
      }
    },

    // ------ Catalog sync ------

    async loadCatalog() {
      try {
        const res = await cvApi.get(API.catalog);
        if (!res.ok) return;
        const data = await res.json();
        if (data.socialCatalog) SOCIAL_CATALOG = data.socialCatalog;
        if (data.latexUnits) LATEX_UNITS = data.latexUnits;
        if (data.identityExtras) IDENTITY_EXTRAS = data.identityExtras;
        if (data.accentColors) ACCENT_COLORS = data.accentColors;
        this.LATEX_UNITS = LATEX_UNITS;
        this.ACCENT_COLORS = ACCENT_COLORS;
      } catch (e) { /* offline — use static fallbacks */ }
    },

    // ------ Undo / Redo ------

    pushUndo(entry) {
      this._undoStack.push(entry);
      if (this._undoStack.length > this._maxUndoDepth) this._undoStack.shift();
      this._redoStack = [];
      this.dirty = true;
    },

    canUndo() { return this._undoStack.length > 0; },
    canRedo() { return this._redoStack.length > 0; },

    undo() {
      if (!this.canUndo()) return;
      const entry = this._undoStack.pop();
      this._redoStack.push(entry);
      this._applyUndoEntry(entry, false);
    },

    redo() {
      if (!this.canRedo()) return;
      const entry = this._redoStack.pop();
      this._undoStack.push(entry);
      this._applyUndoEntry(entry, true);
    },

    _applyUndoEntry(entry, isRedo) {
      const value = isRedo ? entry.newValue : entry.oldValue;
      if (entry.target && entry.field) {
        this[entry.target][entry.field] = value;
        if (entry.target === 'personal') this.autoSavePersonal(entry.field);
        else if (entry.target === 'style') this.autoSaveStyle(entry.field);
        else if (entry.target === 'spacing') this.autoSaveSpacing(entry.field);
        else if (entry.target === 'fonts') this.autoSaveFonts(entry.field);
        else if (entry.target === 'coverletter.settings') {
          this.coverletter.settings[entry.field] = value;
          this.autoSaveCoverletterSetting(entry.field);
        }
      }
    },

    // Snapshot a field value on focus, commit undo entry on blur
    snapshotField(target, field) {
      const val = target === 'coverletter.settings' ? this.coverletter.settings[field] : this[target][field];
      this._focusSnapshot = { target: target, field: field, value: deepClone(val) };
    },

    commitField(target, field) {
      if (!this._focusSnapshot || this._focusSnapshot.target !== target || this._focusSnapshot.field !== field) return;
      const oldVal = this._focusSnapshot.value;
      const newVal = target === 'coverletter.settings' ? this.coverletter.settings[field] : this[target][field];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        this.pushUndo({ target: target, field: field, oldValue: oldVal, newValue: deepClone(newVal) });
      }
      this._focusSnapshot = null;
    },

    // ------ Mobile view ------

    setMobileView(view) {
      this.mobileView = view;
      if (view !== 'editor') {
        this.switchPdfTab(view);
      }
    },

    // ------ Theme ------

    toggleTheme() {
      this.darkMode = !this.darkMode;
      if (window.__setTheme) window.__setTheme(this.darkMode ? 'dark' : 'light');
    },

    // ------ Modal helpers ------

    _selectField(name, label, items, opts) {
      const valueKey = (opts && opts.valueKey) || 'key';
      const labelKey = (opts && opts.labelKey) || 'label';
      const defaultValue = opts && opts.defaultValue;
      const options = items.map(item => ({
        value: String(typeof item[valueKey] !== 'undefined' ? item[valueKey] : item),
        label: String(typeof item[labelKey] !== 'undefined' ? item[labelKey] : item),
      }));
      return { name, label, value: defaultValue || (options[0] && options[0].value) || '', options };
    },

    // ------ Modal system ------

    openModal(title, fields) {
      return new Promise((resolve) => {
        this.modal = {
          open: true, title, resolve,
          fields: fields.map(f => ({ ...f, value: f.value || '', error: null, validate: f.validate || null })),
        };
      });
    },

    validateModalField(field) {
      clearTimeout(this._modalValidateTimer);
      this._modalValidateTimer = setTimeout(() => {
        field.error = field.validate ? field.validate(field.value) : null;
      }, 150);
    },

    modalHasErrors() {
      return this.modal.fields.some(function(f) { return f.error; });
    },

    submitModal() {
      if (this.modalHasErrors()) return;
      const result = {};
      for (const f of this.modal.fields) {
        result[f.name] = f.value;
      }
      this.modal.resolve(result);
      this.modal = { open: false, title: '', fields: [], resolve: null };
    },

    cancelModal() {
      this.modal.resolve(null);
      this.modal = { open: false, title: '', fields: [], resolve: null };
    },

    // ------ Debounced autosave ------

    debounce(key, fn, delay) {
      if (!this.serverConnected) return;
      this.saveState = 'unsaved';
      clearTimeout(this._saveTimers[key]);
      this._saveTimers[key] = setTimeout(fn, delay || 500);
    },
  };

  for (let i = 0; i < mixins.length; i++) {
    Object.assign(base, mixins[i]);
  }
  return base;
}

var JANE_DOE_DEFAULT = {
  personal: {
    firstName: 'Jane', lastName: 'Doe',
    position: 'Senior Software Engineer',
    address: '123 Main Street, Anytown, ST 12345',
    mobile: '(555) 123-4567', email: 'jane.doe@example.com',
    homepage: 'janedoe.dev',
    github: 'janedoe', linkedin: 'janedoe', gitlab: 'janedoe',
    twitter: 'janedoe', orcid: '0000-0001-2345-6789',
    quote: 'Building the future, one commit at a time.',
    photoEnabled: '0', photoFile: '',
  },
  sections: [
    {
      id: 'summary', type: 'cvparagraph', title: 'Summary',
      entries: [{ id: 1, section_id: 'summary', sort_order: 0, resumeIncluded: true,
        fields: { text: 'Experienced software engineer with over 6 years of experience building scalable web applications and distributed systems. Passionate about clean code, mentoring, and continuous learning.' },
        items: [] }]
    },
    {
      id: 'experience', type: 'cventries', title: 'Experience',
      entries: [
        { id: 2, section_id: 'experience', sort_order: 0, resumeIncluded: true,
          fields: { position: 'Senior Software Engineer', organization: 'Acme Technologies', location: 'San Francisco, CA', date: '2022 -- Present' },
          items: [
            { id: 1, entry_id: 2, sort_order: 0, content: 'Led migration of monolithic architecture to microservices, reducing deployment time by 60%', resumeIncluded: true },
            { id: 2, entry_id: 2, sort_order: 1, content: 'Mentored team of 4 junior engineers through code reviews and pair programming sessions', resumeIncluded: true },
          ]
        },
        { id: 3, section_id: 'experience', sort_order: 1, resumeIncluded: true,
          fields: { position: 'Software Engineer', organization: 'Widget Corp', location: 'Austin, TX', date: '2019 -- 2022' },
          items: [
            { id: 3, entry_id: 3, sort_order: 0, content: 'Designed and implemented RESTful API serving 10,000 requests per second', resumeIncluded: true },
            { id: 4, entry_id: 3, sort_order: 1, content: 'Developed automated testing pipeline reducing QA cycle from 2 weeks to 3 days', resumeIncluded: true },
          ]
        }
      ]
    },
    {
      id: 'education', type: 'cventries', title: 'Education',
      entries: [
        { id: 4, section_id: 'education', sort_order: 0, resumeIncluded: true,
          fields: { position: 'B.S. Computer Science', organization: 'State University', location: 'Anytown, ST', date: '2015 -- 2019' },
          items: [
            { id: 5, entry_id: 4, sort_order: 0, content: 'Graduated magna cum laude, GPA 3.8/4.0', resumeIncluded: true },
          ]
        }
      ]
    },
    {
      id: 'skills', type: 'cvskills', title: 'Skills',
      entries: [
        { id: 5, section_id: 'skills', sort_order: 0, resumeIncluded: true, fields: { category: 'Languages', skills: 'JavaScript, Python, Go, Rust, SQL' }, items: [] },
        { id: 6, section_id: 'skills', sort_order: 1, resumeIncluded: true, fields: { category: 'Frameworks', skills: 'React, Node.js, Express, Django' }, items: [] },
        { id: 7, section_id: 'skills', sort_order: 2, resumeIncluded: true, fields: { category: 'Tools', skills: 'Docker, Kubernetes, Git, CI/CD, AWS' }, items: [] },
      ]
    },
  ],
  metrics: [
    { id: 1, command: 'projectCount', label: 'Projects', value: '15', groupName: 'General', sectionId: 'experience' },
    { id: 2, command: 'yearsExperience', label: 'Years', value: '6', groupName: 'General', sectionId: 'experience' },
  ],
  documents: {
    cv: [
      { sectionId: 'summary', enabled: true, sortOrder: 0, resumeParagraphText: null },
      { sectionId: 'experience', enabled: true, sortOrder: 1, resumeParagraphText: null },
      { sectionId: 'education', enabled: true, sortOrder: 2, resumeParagraphText: null },
      { sectionId: 'skills', enabled: true, sortOrder: 3, resumeParagraphText: null },
    ],
    resume: [
      { sectionId: 'summary', enabled: true, sortOrder: 0, resumeParagraphText: 'Software engineer with 6 years of experience in web applications and distributed systems.' },
      { sectionId: 'experience', enabled: true, sortOrder: 1, resumeParagraphText: null },
      { sectionId: 'skills', enabled: true, sortOrder: 2, resumeParagraphText: null },
    ]
  },
  coverletter: {
    recipientName: 'Hiring Manager',
    recipientAddress: '456 Corporate Ave, Business City, ST 67890',
    title: 'Application for Software Engineer Position',
    opening: 'Dear Hiring Manager,',
    closing: 'Sincerely,',
    enclosureLabel: 'Attached',
    enclosureContent: 'Resume, Portfolio',
    sections: [
      { id: 1, sort_order: 0, title: 'Introduction', body: 'I am writing to express my interest in the Software Engineer position at your company. With over six years of experience in building scalable systems, I am confident I would be a strong addition to your team.' },
      { id: 2, sort_order: 1, title: 'Experience', body: 'In my current role at Acme Technologies, I have led the migration of a monolithic application to a microservices architecture, resulting in significant improvements in deployment speed and system reliability.' },
    ]
  }
};

function app() {
  return {
    activeDoc: 'cv',
    sections: [],
    docSections: [],
    personal: {},
    metrics: [],
    coverletter: { settings: {}, sections: [] },
    compiling: false,
    statusMsg: '',
    statusType: '',
    sortable: null,
    darkMode: true,
    dirty: false,
    isJaneDoe: false,
    sidebarMode: 'pdf',  // 'pdf' or 'variables'
    pdfUrl: '',
    _nextTempId: -1,
    _documents: { cv: [], resume: [] },

    // New state
    persons: [],
    activePersonId: null,
    activeTab: 'sections',
    expandedSectionId: null,
    serverConnected: false,

    // Modal state
    modal: { open: false, title: '', fields: [], resolve: null },

    async init() {
      this.darkMode = document.documentElement.dataset.theme !== 'light';
      // Always start offline with Jane Doe — user must click Connect for server data
      this.serverConnected = false;
      this.loadFromJson(JANE_DOE_DEFAULT);
      this.isJaneDoe = true;
      this.dirty = false;
      this.updatePdfUrl();
      this.$nextTick(function() { this.initSortable(); }.bind(this));
    },

    async connectToServer() {
      try {
        await this.loadPersons();
        this.serverConnected = true;
        var person = this.persons.find(function(p) { return p.id === this.activePersonId; }.bind(this));
        if (person && person.name === 'Jane Doe') {
          this.loadFromJson(JANE_DOE_DEFAULT);
          this.isJaneDoe = true;
        } else {
          var exp = await fetch(API_BASE + '/api/export');
          if (!exp.ok) throw new Error('Failed to load');
          this.loadFromJson(await exp.json());
          this.isJaneDoe = false;
        }
        this.dirty = false;
        this.updatePdfUrl();
        this.$nextTick(function() { this.initSortable(); }.bind(this));
      } catch (e) {
        this.serverConnected = false;
        throw e;
      }
    },

    // ------ Theme ------

    updatePdfUrl() {
      if (this.isJaneDoe) {
        var variant = this.activeDoc === 'coverletter' ? 'cv' : this.activeDoc;
        this.pdfUrl = '/cv/jane-doe-' + variant + '.pdf';
      } else if (this.serverConnected) {
        this.pdfUrl = API_BASE + '/api/pdf/' + this.activeDoc + '?t=' + Date.now();
      } else {
        this.pdfUrl = '';
      }
    },

    toggleTheme() {
      this.darkMode = !this.darkMode;
      if (window.__setTheme) window.__setTheme(this.darkMode ? 'dark' : 'light');
    },

    // ------ Persons ------

    async loadPersons() {
      var res = await fetch(API_BASE + '/api/persons');
      if (!res.ok) throw new Error('Failed to load persons');
      var data = await res.json();
      this.persons = data.persons;
      this.activePersonId = data.activePersonId;
    },

    async switchPerson(id) {
      if (id === this.activePersonId) return;
      if (this.dirty && !confirm('You have unsaved changes. Switch anyway?')) return;
      var res = await fetch(API_BASE + '/api/persons/' + id + '/switch', { method: 'POST' });
      if (!res.ok) { this.flash('Failed to switch', 'error'); return; }
      this.activePersonId = id;
      var person = this.persons.find(function(p) { return p.id === id; });
      if (person && person.name === 'Jane Doe') {
        this.loadFromJson(JANE_DOE_DEFAULT);
        this.isJaneDoe = true;
      } else {
        var exp = await fetch(API_BASE + '/api/export');
        if (exp.ok) this.loadFromJson(await exp.json());
        this.isJaneDoe = false;
      }
      this.dirty = false;
      this.$nextTick(function() { this.initSortable(); }.bind(this));
      this.flash('Switched to ' + (person ? person.name : ''), 'success');
    },

    async createPerson() {
      var result = await this.openModal('New Person', [
        { name: 'name', label: 'Name', value: '' },
      ]);
      if (!result || !result.name.trim()) return;
      var res = await fetch(API_BASE + '/api/persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: result.name.trim() }),
      });
      if (res.status === 409) { this.flash('Name already exists', 'error'); return; }
      if (!res.ok) { this.flash('Failed to create', 'error'); return; }
      await this.loadPersons();
      this.flash('Created ' + result.name.trim(), 'success');
    },

    async deletePerson(id) {
      if (id === this.activePersonId) { this.flash('Cannot delete active person', 'error'); return; }
      var person = this.persons.find(function(p) { return p.id === id; });
      if (!confirm('Delete "' + (person ? person.name : '') + '"?')) return;
      await fetch(API_BASE + '/api/persons/' + id, { method: 'DELETE' });
      await this.loadPersons();
      this.flash('Deleted', 'success');
    },

    async renamePerson(id) {
      var person = this.persons.find(function(p) { return p.id === id; });
      var result = await this.openModal('Rename Person', [
        { name: 'name', label: 'Name', value: person ? person.name : '' },
      ]);
      if (!result || !result.name.trim()) return;
      var res = await fetch(API_BASE + '/api/persons/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: result.name.trim() }),
      });
      if (res.status === 409) { this.flash('Name already exists', 'error'); return; }
      await this.loadPersons();
    },

    // ------ Import / Export ------

    async exportData() {
      var data = this.toExportJson();
      var person = this.persons.find(function(p) { return p.id === this.activePersonId; }.bind(this));
      var name = person ? person.name.toLowerCase().replace(/\s+/g, '-') : (this.isJaneDoe ? 'jane-doe' : 'export');
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      this.flash('Exported', 'success');
    },

    importData() {
      var self = this;
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = function() {
        var file = input.files[0];
        if (!file) return;
        file.text().then(function(text) {
          try {
            var data = JSON.parse(text);
            self.loadFromJson(data);
            self.dirty = true;
            self.$nextTick(function() { self.initSortable(); });
            self.flash('Imported (not yet saved)', 'success');
          } catch (e) {
            self.flash('Invalid JSON file', 'error');
          }
        });
      };
      input.click();
    },

    // ------ Data loading ------

    loadFromJson(data) {
      this.personal = Object.assign({}, data.personal || {});
      this.metrics = (data.metrics || []).map(function(m) { return Object.assign({}, m); });

      this.sections = (data.sections || []).map(function(s) {
        return {
          id: s.id, type: s.type, title: s.title,
          entries: (s.entries || []).map(function(e) {
            return {
              id: e.id, fields: Object.assign({}, e.fields),
              resumeIncluded: e.resumeIncluded !== false,
              items: (e.items || []).map(function(i) {
                return { id: i.id, content: i.content, resumeIncluded: i.resumeIncluded !== false };
              })
            };
          })
        };
      });

      this._documents = Object.assign({}, data.documents || { cv: [], resume: [] });

      var variantDoc = (this._documents[this.activeDoc] || this._documents.cv || []);
      this.docSections = [];
      var self = this;
      for (var i = 0; i < variantDoc.length; i++) {
        var ds = variantDoc[i];
        var sec = self.sections.find(function(s) { return s.id === ds.sectionId; });
        if (!sec) continue;
        self.docSections.push({
          id: sec.id, type: sec.type, title: sec.title,
          enabled: ds.enabled !== false,
          resumeParagraphText: ds.resumeParagraphText || null,
          _expanded: false,
          entries: sec.entries
        });
      }

      var cl = data.coverletter || {};
      var clSettings = {};
      for (var key in cl) { if (key !== 'sections') clSettings[key] = cl[key]; }
      this.coverletter = { settings: clSettings, sections: (cl.sections || []).map(function(s) { return Object.assign({}, s); }) };
    },

    // ------ Export to JSON ------

    toExportJson() {
      var personal = Object.assign({}, this.personal);

      var sections = this.sections.map(function(s) {
        return {
          id: s.id, type: s.type, title: s.title,
          entries: (s.entries || []).map(function(e, ei) {
            return {
              id: e.id, section_id: s.id, sort_order: ei,
              fields: e.fields, resumeIncluded: e.resumeIncluded,
              items: (e.items || []).map(function(it, ii) {
                return { id: it.id, entry_id: e.id, sort_order: ii,
                  content: it.content, resumeIncluded: it.resumeIncluded };
              })
            };
          })
        };
      });

      var metrics = this.metrics.map(function(m) {
        return { id: m.id, command: m.command, label: m.label,
          value: m.value, groupName: m.groupName, sectionId: m.sectionId };
      });

      // Update current variant's doc config from local docSections
      var docs = {};
      for (var v in this._documents) { docs[v] = this._documents[v]; }
      var curVariant = (this.activeDoc === 'coverletter') ? 'cv' : this.activeDoc;
      docs[curVariant] = this.docSections.map(function(s, i) {
        return { sectionId: s.id, enabled: s.enabled,
          sortOrder: i, resumeParagraphText: s.resumeParagraphText || null };
      });

      var coverletter = Object.assign({}, this.coverletter.settings);
      coverletter.sections = this.coverletter.sections;

      return { personal: personal, sections: sections, metrics: metrics,
        documents: docs, coverletter: coverletter };
    },

    // ------ Save ------

    async save() {
      if (!this.serverConnected || this.isJaneDoe) return;
      var data = this.toExportJson();
      var res = await fetch(API_BASE + '/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) { this.flash('Save failed', 'error'); return; }
      var exp = await fetch(API_BASE + '/api/export');
      if (exp.ok) {
        this.loadFromJson(await exp.json());
        this.$nextTick(function() { this.initSortable(); }.bind(this));
      }
      this.dirty = false;
      this.flash('Saved', 'success');
    },

    // ------ Modal system ------

    openModal(title, fields) {
      var self = this;
      return new Promise(function(resolve) {
        self.modal = { open: true, title: title, fields: fields.map(function(f) { return { name: f.name, label: f.label, value: f.value || '' }; }), resolve: resolve };
      });
    },

    submitModal() {
      var result = {};
      for (var i = 0; i < this.modal.fields.length; i++) {
        var f = this.modal.fields[i];
        result[f.name] = f.value;
      }
      this.modal.resolve(result);
      this.modal = { open: false, title: '', fields: [], resolve: null };
    },

    cancelModal() {
      this.modal.resolve(null);
      this.modal = { open: false, title: '', fields: [], resolve: null };
    },

    // ------ Personal info ------

    togglePhoto() {
      this.personal.photoEnabled = this.personal.photoEnabled === '1' ? '0' : '1';
      this.dirty = true;
    },

    // ------ Metrics ------

    metricsForSection(sectionId) {
      return this.metrics.filter(function(m) { return m.sectionId === sectionId; });
    },

    metricGroupsForSection(sectionId) {
      var metrics = this.metricsForSection(sectionId);
      var groups = {};
      for (var i = 0; i < metrics.length; i++) {
        var m = metrics[i];
        var g = m.groupName || 'Ungrouped';
        if (!groups[g]) groups[g] = [];
        groups[g].push(m);
      }
      return Object.entries(groups);
    },

    async addMetric(sectionId, groupName) {
      var result = await this.openModal('Add Variable', [
        { name: 'command', label: 'Command name (e.g., myMetric)', value: '' },
        { name: 'label', label: 'Placeholder label', value: '' },
      ]);
      if (!result || !result.command.trim()) return;
      var cmd = result.command.trim();
      if (this.metrics.some(function(m) { return m.command === cmd; })) {
        this.flash('Command already exists', 'error'); return;
      }
      this.metrics.push({
        id: this._nextTempId--, command: cmd,
        label: result.label.trim() || cmd, value: null,
        groupName: groupName, sectionId: sectionId
      });
      this.dirty = true;
    },

    removeMetric(metricId) {
      this.metrics = this.metrics.filter(function(m) { return m.id !== metricId; });
      this.dirty = true;
    },

    async addMetricGroup(sectionId) {
      var result = await this.openModal('New Variable Group', [
        { name: 'groupName', label: 'Group name', value: '' },
        { name: 'command', label: 'First variable command name', value: '' },
        { name: 'label', label: 'Placeholder label', value: '' },
      ]);
      if (!result || !result.groupName.trim() || !result.command.trim()) return;
      var cmd = result.command.trim();
      if (this.metrics.some(function(m) { return m.command === cmd; })) {
        this.flash('Command already exists', 'error'); return;
      }
      this.metrics.push({
        id: this._nextTempId--, command: cmd,
        label: result.label.trim() || cmd, value: null,
        groupName: result.groupName.trim(), sectionId: sectionId
      });
      this.dirty = true;
    },

    removeMetricGroup(sectionId, groupName) {
      this.metrics = this.metrics.filter(function(m) {
        return !(m.sectionId === sectionId && m.groupName === groupName);
      });
      this.dirty = true;
    },

    async renameMetricGroup(sectionId, oldGroup) {
      var result = await this.openModal('Rename Group', [
        { name: 'groupName', label: 'New group name', value: oldGroup },
      ]);
      if (!result || !result.groupName.trim() || result.groupName.trim() === oldGroup) return;
      var newName = result.groupName.trim();
      for (var i = 0; i < this.metrics.length; i++) {
        if (this.metrics[i].sectionId === sectionId && this.metrics[i].groupName === oldGroup) {
          this.metrics[i].groupName = newName;
        }
      }
      this.dirty = true;
    },

    // ------ Section CRUD ------

    async createNewSection() {
      var result = await this.openModal('New Section', [
        { name: 'title', label: 'Section Title (e.g. Projects)', value: '' },
        { name: 'type', label: 'Type: cventries, cvskills, cvhonors, cvreferences, cvparagraph', value: 'cventries' },
      ]);
      if (!result || !result.title.trim()) return;
      var id = result.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      if (!id) return;
      var type = result.type.trim();
      var validTypes = ['cventries', 'cvskills', 'cvhonors', 'cvreferences', 'cvparagraph'];
      if (validTypes.indexOf(type) === -1) { this.flash('Invalid type', 'error'); return; }
      if (this.sections.some(function(s) { return s.id === id; })) { this.flash('Section ID already exists', 'error'); return; }
      var newSec = { id: id, type: type, title: result.title.trim(), entries: [] };
      this.sections.push(newSec);
      this.docSections.push({
        id: id, type: type, title: result.title.trim(),
        enabled: true, resumeParagraphText: null,
        _expanded: false, entries: newSec.entries
      });
      this.dirty = true;
      this.flash('Created "' + result.title.trim() + '"', 'success');
    },

    deleteSection(sectionId) {
      var sec = this.sections.find(function(s) { return s.id === sectionId; });
      if (!confirm('Delete "' + (sec ? sec.title : sectionId) + '"?')) return;
      this.sections = this.sections.filter(function(s) { return s.id !== sectionId; });
      this.docSections = this.docSections.filter(function(s) { return s.id !== sectionId; });
      this.metrics = this.metrics.filter(function(m) { return m.sectionId !== sectionId; });
      if (this.expandedSectionId === sectionId) this.expandedSectionId = null;
      this.dirty = true;
    },

    async renameSection(sectionId) {
      var sec = this.sections.find(function(s) { return s.id === sectionId; });
      var result = await this.openModal('Rename Section', [
        { name: 'title', label: 'New title', value: sec ? sec.title : '' },
      ]);
      if (!result || !result.title.trim()) return;
      if (sec) sec.title = result.title.trim();
      var ds = this.docSections.find(function(s) { return s.id === sectionId; });
      if (ds) ds.title = result.title.trim();
      this.dirty = true;
    },

    toggleSectionExpand(sec) {
      sec._expanded = !sec._expanded;
      if (sec._expanded) {
        this.expandedSectionId = sec.id;
      } else {
        if (this.expandedSectionId === sec.id) this.expandedSectionId = null;
      }
    },

    // ------ Sections + Document config ------

    async switchDoc(name) {
      // Save current variant's docSections to _documents before switching
      var oldVariant = (this.activeDoc === 'coverletter') ? 'cv' : this.activeDoc;
      this._documents[oldVariant] = this.docSections.map(function(s, i) {
        return { sectionId: s.id, enabled: s.enabled,
          sortOrder: i, resumeParagraphText: s.resumeParagraphText || null };
      });

      this.activeDoc = name;
      if (name !== 'coverletter') {
        // Load docSections for new variant from _documents
        var variantDoc = this._documents[name] || [];
        this.docSections = [];
        var self = this;
        for (var i = 0; i < variantDoc.length; i++) {
          var ds = variantDoc[i];
          var sec = self.sections.find(function(s) { return s.id === ds.sectionId; });
          if (!sec) continue;
          self.docSections.push({
            id: sec.id, type: sec.type, title: sec.title,
            enabled: ds.enabled !== false,
            resumeParagraphText: ds.resumeParagraphText || null,
            _expanded: false, entries: sec.entries
          });
        }
        this.$nextTick(function() { this.initSortable(); }.bind(this));
      }
      this.updatePdfUrl();
    },

    initSortable() {
      if (this.sortable) this.sortable.destroy();
      var el = document.getElementById('section-list');
      if (!el) return;
      var self = this;
      this.sortable = Sortable.create(el, {
        handle: '.ui-drag-handle',
        ghostClass: 'ui-sortable-ghost',
        chosenClass: 'ui-sortable-chosen',
        animation: 150,
        onEnd: function(evt) {
          var item = self.docSections.splice(evt.oldIndex, 1)[0];
          self.docSections.splice(evt.newIndex, 0, item);
          self.saveDocumentSections();
        },
      });
    },

    saveDocumentSections() {
      // Just update local _documents - no server call
      var variant = (this.activeDoc === 'coverletter') ? 'cv' : this.activeDoc;
      this._documents[variant] = this.docSections.map(function(s, i) {
        return { sectionId: s.id, enabled: s.enabled,
          sortOrder: i, resumeParagraphText: s.resumeParagraphText || null };
      });
      this.dirty = true;
    },

    toggleSection(index) {
      this.docSections[index].enabled = !this.docSections[index].enabled;
      this.dirty = true;
    },

    // ------ Entry CRUD ------

    async addEntry(sec) {
      var defaults = {};
      if (sec.type === 'cventries') Object.assign(defaults, { position: '', organization: '', location: '', date: '' });
      else if (sec.type === 'cvskills') Object.assign(defaults, { category: '', skills: '' });
      else if (sec.type === 'cvhonors') Object.assign(defaults, { award: '', issuer: '', location: '', date: '' });
      else if (sec.type === 'cvreferences') Object.assign(defaults, { name: '', relation: '', phone: '', email: '' });
      else if (sec.type === 'cvparagraph') Object.assign(defaults, { text: '' });
      var newEntry = { id: this._nextTempId--, fields: defaults, resumeIncluded: true, items: [] };
      sec.entries.push(newEntry);
      // Also update the master sections array
      var master = this.sections.find(function(s) { return s.id === sec.id; });
      if (master && master !== sec) master.entries = sec.entries;
      this.dirty = true;
    },

    removeEntry(sec, entryId) {
      sec.entries = sec.entries.filter(function(e) { return e.id !== entryId; });
      var master = this.sections.find(function(s) { return s.id === sec.id; });
      if (master && master !== sec) master.entries = sec.entries;
      this.dirty = true;
    },

    toggleResumeEntry(entry) {
      entry.resumeIncluded = !entry.resumeIncluded;
      this.dirty = true;
    },

    // ------ Item (bullet) CRUD ------

    addItem(entry) {
      entry.items.push({ id: this._nextTempId--, content: '', resumeIncluded: true });
      this.dirty = true;
    },

    removeItem(entry, itemId) {
      entry.items = entry.items.filter(function(i) { return i.id !== itemId; });
      this.dirty = true;
    },

    toggleResumeItem(item) {
      item.resumeIncluded = !item.resumeIncluded;
      this.dirty = true;
    },

    // ------ Cover letter ------

    addCoverletterSection() {
      this.coverletter.sections.push({
        id: this._nextTempId--, sort_order: this.coverletter.sections.length,
        title: '', body: ''
      });
      this.dirty = true;
    },

    removeCoverletterSection(secId) {
      this.coverletter.sections = this.coverletter.sections.filter(function(s) { return s.id !== secId; });
      this.dirty = true;
    },

    // ------ Compile & PDF ------

    async compile() {
      if (!this.serverConnected) { this.flash('Connect to server first', 'error'); return; }
      this.compiling = true;
      try {
        if (!this.isJaneDoe) await this.save();
        var name = this.activeDoc;
        var res = await fetch(API_BASE + '/api/compile/' + name, { method: 'POST' });
        var data = await res.json();
        if (data.success) {
          this.flash(name.charAt(0).toUpperCase() + name.slice(1) + ' compiled', 'success');
          this.pdfUrl = API_BASE + '/api/pdf/' + name + '?t=' + Date.now();
          this.sidebarMode = 'pdf';
          // Also trigger download
          var a = document.createElement('a');
          a.href = this.pdfUrl;
          a.download = name + '.pdf';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          this.flash('Compilation failed - check console', 'error');
          console.error(data.log);
        }
      } catch (e) {
        this.flash('Compilation error', 'error');
      }
      this.compiling = false;
    },

    // ------ UI helpers ------

    flash(msg, type) {
      this.statusMsg = msg;
      this.statusType = type === 'success' ? 'ui-alert-success' : type === 'error' ? 'ui-alert-danger' : '';
      clearTimeout(this._flashTimer);
      var self = this;
      this._flashTimer = setTimeout(function() { self.statusMsg = ''; }, 3000);
    },
  };
}

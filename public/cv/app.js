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
    _saveTimers: {},

    // New state
    persons: [],
    activePersonId: null,
    activeTab: 'sections',
    serverConnected: false,

    // Modal state
    modal: { open: false, title: '', fields: [], resolve: null },

    async init() {
      this.darkMode = document.documentElement.dataset.theme !== 'light';
      try {
        await this.loadPersons();
        this.serverConnected = true;
        await Promise.all([
          this.loadPersonal(),
          this.loadMetrics(),
          this.loadSections(),
          this.loadDocumentSections('cv'),
          this.loadCoverletter(),
        ]);
      } catch (e) {
        this.serverConnected = false;
        this.loadFromJson(JANE_DOE_DEFAULT);
      }
      this.$watch('activeDoc', function(val) {
        if (val !== 'coverletter') {
          this.loadDocumentSections(val);
        }
      }.bind(this));
    },

    // ------ Theme ------

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
      var res = await fetch(API_BASE + '/api/persons/' + id + '/switch', { method: 'POST' });
      if (!res.ok) { this.flash('Failed to switch', 'error'); return; }
      this.activePersonId = id;
      await Promise.all([
        this.loadPersonal(),
        this.loadMetrics(),
        this.loadSections(),
        this.loadDocumentSections(this.activeDoc === 'coverletter' ? 'cv' : this.activeDoc),
        this.loadCoverletter(),
      ]);
      this.flash('Switched to ' + (this.persons.find(function(p) { return p.id === id; }) || {}).name, 'success');
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
      if (!this.serverConnected) {
        var blob = new Blob([JSON.stringify(JANE_DOE_DEFAULT, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'jane-doe.json';
        a.click();
        URL.revokeObjectURL(a.href);
        return;
      }
      var res = await fetch(API_BASE + '/api/export');
      if (!res.ok) { this.flash('Export failed', 'error'); return; }
      var data = await res.json();
      var self = this;
      var person = this.persons.find(function(p) { return p.id === self.activePersonId; });
      var name = person ? person.name.toLowerCase().replace(/\s+/g, '-') : 'export';
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
      input.onchange = async function() {
        var file = input.files[0];
        if (!file) return;
        try {
          var text = await file.text();
          var data = JSON.parse(text);
          if (self.serverConnected) {
            var res = await fetch(API_BASE + '/api/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: text,
            });
            if (!res.ok) { self.flash('Import failed', 'error'); return; }
            await Promise.all([
              self.loadPersonal(),
              self.loadMetrics(),
              self.loadSections(),
              self.loadDocumentSections(self.activeDoc === 'coverletter' ? 'cv' : self.activeDoc),
              self.loadCoverletter(),
            ]);
            self.flash('Imported', 'success');
          } else {
            self.loadFromJson(data);
            self.flash('Loaded from file', 'success');
          }
        } catch (e) {
          self.flash('Invalid JSON file', 'error');
        }
      };
      input.click();
    },

    // ------ Offline data loading ------

    loadFromJson(data) {
      // Personal
      this.personal = data.personal || {};

      // Metrics
      this.metrics = data.metrics || [];

      // Sections
      this.sections = (data.sections || []).map(function(s) { return { id: s.id, type: s.type, title: s.title }; });

      // Document sections for CV
      var cvDoc = (data.documents && data.documents.cv) || [];
      this.docSections = [];
      for (var i = 0; i < cvDoc.length; i++) {
        var ds = cvDoc[i];
        var sec = data.sections.find(function(s) { return s.id === ds.sectionId; });
        if (!sec) continue;
        this.docSections.push({
          id: sec.id, type: sec.type, title: sec.title,
          enabled: ds.enabled,
          resumeParagraphText: ds.resumeParagraphText,
          _expanded: true,
          _data: { id: sec.id, type: sec.type, title: sec.title, entries: sec.entries },
        });
      }

      // Coverletter
      var cl = data.coverletter || {};
      var clSettings = {};
      for (var key in cl) {
        if (key !== 'sections') clSettings[key] = cl[key];
      }
      this.coverletter = { settings: clSettings, sections: cl.sections || [] };
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

    // ------ Debounced autosave ------

    debounce(key, fn, delay) {
      if (delay === undefined) delay = 500;
      clearTimeout(this._saveTimers[key]);
      this._saveTimers[key] = setTimeout(fn, delay);
    },

    // ------ Personal info ------

    async loadPersonal() {
      var res = await fetch(API_BASE + '/api/settings?prefix=personal');
      if (!res.ok) return;
      var data = await res.json();
      var p = {};
      var entries = Object.entries(data);
      for (var i = 0; i < entries.length; i++) {
        p[entries[i][0].replace('personal.', '')] = entries[i][1];
      }
      this.personal = p;
    },

    autoSavePersonal(field) {
      var self = this;
      this.debounce('personal.' + field, async function() {
        var body = {};
        body['personal.' + field] = self.personal[field] || '';
        await fetch(API_BASE + '/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        self.flash('Saved', 'success');
      });
    },

    togglePhoto() {
      var enabled = this.personal.photoEnabled === '1' ? '0' : '1';
      this.personal.photoEnabled = enabled;
      fetch(API_BASE + '/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'personal.photoEnabled': enabled }),
      });
    },

    // ------ Metrics ------

    async loadMetrics() {
      var res = await fetch(API_BASE + '/api/metrics');
      if (!res.ok) return;
      this.metrics = await res.json();
    },

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

    autoSaveMetric(metric) {
      var self = this;
      this.debounce('metric.' + metric.id, async function() {
        await fetch(API_BASE + '/api/metrics/' + metric.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: metric.value === '' ? null : metric.value }),
        });
        self.flash('Saved', 'success');
      });
    },

    async addMetric(sectionId, groupName) {
      var result = await this.openModal('Add Variable', [
        { name: 'command', label: 'Command name (e.g., myMetric)', value: '' },
        { name: 'label', label: 'Placeholder label', value: '' },
      ]);
      if (!result || !result.command.trim()) return;
      var res = await fetch(API_BASE + '/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: result.command.trim(),
          label: result.label.trim() || result.command.trim(),
          value: null,
          groupName: groupName,
          sectionId: sectionId,
        }),
      });
      if (res.status === 409) { this.flash('Command already exists', 'error'); return; }
      if (!res.ok) { this.flash('Failed to add', 'error'); return; }
      await this.loadMetrics();
    },

    async removeMetric(metricId) {
      await fetch(API_BASE + '/api/metrics/' + metricId, { method: 'DELETE' });
      await this.loadMetrics();
    },

    async addMetricGroup(sectionId) {
      var result = await this.openModal('New Variable Group', [
        { name: 'groupName', label: 'Group name', value: '' },
        { name: 'command', label: 'First variable command name', value: '' },
        { name: 'label', label: 'Placeholder label', value: '' },
      ]);
      if (!result || !result.groupName.trim() || !result.command.trim()) return;
      var res = await fetch(API_BASE + '/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: result.command.trim(),
          label: result.label.trim() || result.command.trim(),
          value: null,
          groupName: result.groupName.trim(),
          sectionId: sectionId,
        }),
      });
      if (res.status === 409) { this.flash('Command already exists', 'error'); return; }
      if (!res.ok) { this.flash('Failed to add', 'error'); return; }
      await this.loadMetrics();
    },

    async removeMetricGroup(sectionId, groupName) {
      var toRemove = this.metrics.filter(function(m) { return m.sectionId === sectionId && m.groupName === groupName; });
      for (var i = 0; i < toRemove.length; i++) {
        await fetch(API_BASE + '/api/metrics/' + toRemove[i].id, { method: 'DELETE' });
      }
      await this.loadMetrics();
    },

    async renameMetricGroup(sectionId, oldGroup) {
      var result = await this.openModal('Rename Group', [
        { name: 'groupName', label: 'New group name', value: oldGroup },
      ]);
      if (!result || !result.groupName.trim() || result.groupName.trim() === oldGroup) return;
      var toRename = this.metrics.filter(function(m) { return m.sectionId === sectionId && m.groupName === oldGroup; });
      for (var i = 0; i < toRename.length; i++) {
        await fetch(API_BASE + '/api/metrics/' + toRename[i].id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupName: result.groupName.trim() }),
        });
      }
      await this.loadMetrics();
    },

    // ------ Sections + Document config ------

    async loadSections() {
      var res = await fetch(API_BASE + '/api/sections');
      if (!res.ok) return;
      this.sections = await res.json();
    },

    async loadDocumentSections(variant) {
      var res = await fetch(API_BASE + '/api/documents/' + variant);
      if (!res.ok) return;
      var data = await res.json();
      var self = this;
      this.docSections = [];
      for (var i = 0; i < data.sections.length; i++) {
        var ds = data.sections[i];
        var sec = this.sections.find(function(s) { return s.id === ds.sectionId; });
        if (!sec) continue;
        this.docSections.push({
          id: sec.id, type: sec.type, title: sec.title,
          enabled: ds.enabled,
          resumeParagraphText: ds.resumeParagraphText,
          _expanded: true,
          _data: null,
        });
      }
      this.$nextTick(function() {
        self.initSortable();
        for (var j = 0; j < self.docSections.length; j++) {
          if (self.docSections[j].enabled) self.loadSectionData(self.docSections[j]);
        }
      });
    },

    async switchDoc(name) {
      this.activeDoc = name;
      if (name !== 'coverletter' && this.serverConnected) {
        await this.loadDocumentSections(name);
      }
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

    async saveDocumentSections() {
      var variant = this.activeDoc;
      var sections = this.docSections.map(function(s) {
        return {
          sectionId: s.id,
          enabled: s.enabled,
          resumeParagraphText: s.resumeParagraphText || null,
        };
      });
      await fetch(API_BASE + '/api/documents/' + variant, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: sections }),
      });
      this.flash('Order saved', 'success');
    },

    toggleSection(index) {
      this.docSections[index].enabled = !this.docSections[index].enabled;
      this.saveDocumentSections();
    },

    // ------ Section data (entries + items) ------

    async loadSectionData(sec) {
      if (sec._data) return;
      var self = this;
      var res = await fetch(API_BASE + '/api/sections/' + sec.id);
      if (!res.ok) return;
      sec._data = await res.json();
      if (sec._data.type === 'cventries') {
        this.$nextTick(function() { self.initBulletSortables(sec); });
      }
    },

    initBulletSortables(sec) {
      this.$nextTick(function() {
        var allLists = document.querySelectorAll('.items-list[data-sec-id="' + sec.id + '"]');
        allLists.forEach(function(list) {
          if (list._sortable) { list._sortable.destroy(); list._sortable = null; }
          list._sortable = Sortable.create(list, {
            handle: '.ui-drag-handle',
            ghostClass: 'ui-sortable-ghost',
            chosenClass: 'ui-sortable-chosen',
            draggable: '.item-row',
            animation: 100,
            onEnd: function(evt) {
              var entryId = parseInt(list.dataset.entryId);
              var entry = sec._data.entries.find(function(e) { return e.id === entryId; });
              if (!entry) return;
              var item = entry.items.splice(evt.oldIndex, 1)[0];
              entry.items.splice(evt.newIndex, 0, item);
              var ids = entry.items.map(function(i) { return i.id; });
              fetch(API_BASE + '/api/entries/' + entryId + '/items/order', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: ids }),
              });
            },
          });
        });
      });
    },

    // ------ Entry CRUD ------

    autoSaveEntry(entry) {
      var self = this;
      this.debounce('entry.' + entry.id, async function() {
        await fetch(API_BASE + '/api/entries/' + entry.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: entry.fields }),
        });
        self.flash('Saved', 'success');
      });
    },

    async addEntry(sec) {
      var defaults = {};
      if (sec.type === 'cventries') {
        defaults = { position: '', organization: '', location: '', date: '' };
      } else if (sec.type === 'cvskills') {
        defaults = { category: '', skills: '' };
      } else if (sec.type === 'cvhonors') {
        defaults = { award: '', issuer: '', location: '', date: '' };
      } else if (sec.type === 'cvreferences') {
        defaults = { name: '', relation: '', phone: '', email: '' };
      } else if (sec.type === 'cvparagraph') {
        defaults = { text: '' };
      }
      var res = await fetch(API_BASE + '/api/sections/' + sec.id + '/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: defaults }),
      });
      if (!res.ok) { this.flash('Failed to add', 'error'); return; }
      sec._data = null;
      await this.loadSectionData(sec);
    },

    async removeEntry(sec, entryId) {
      await fetch(API_BASE + '/api/entries/' + entryId, { method: 'DELETE' });
      sec._data.entries = sec._data.entries.filter(function(e) { return e.id !== entryId; });
    },

    toggleResumeEntry(entry) {
      entry.resumeIncluded = !entry.resumeIncluded;
      fetch(API_BASE + '/api/entries/' + entry.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeIncluded: entry.resumeIncluded }),
      });
    },

    // ------ Item (bullet) CRUD ------

    autoSaveItem(item) {
      var self = this;
      this.debounce('item.' + item.id, async function() {
        await fetch(API_BASE + '/api/items/' + item.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: item.content }),
        });
        self.flash('Saved', 'success');
      });
    },

    async addItem(entry) {
      var res = await fetch(API_BASE + '/api/entries/' + entry.id + '/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      });
      if (!res.ok) return;
      var data = await res.json();
      entry.items.push({ id: data.id, content: '', resumeIncluded: true, sort_order: entry.items.length, entry_id: entry.id });
    },

    async removeItem(entry, itemId) {
      await fetch(API_BASE + '/api/items/' + itemId, { method: 'DELETE' });
      entry.items = entry.items.filter(function(i) { return i.id !== itemId; });
    },

    toggleResumeItem(item) {
      item.resumeIncluded = !item.resumeIncluded;
      fetch(API_BASE + '/api/items/' + item.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeIncluded: item.resumeIncluded }),
      });
    },

    // ------ cvparagraph: autosave text + resume text ------

    autoSaveParagraph(sec) {
      var entry = sec._data.entries[0];
      if (!entry) return;
      var self = this;
      this.debounce('para.' + entry.id, async function() {
        await fetch(API_BASE + '/api/entries/' + entry.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: entry.fields }),
        });
        self.flash('Saved', 'success');
      });
    },

    autoSaveResumeParagraphText(sec) {
      this.debounce('rpt.' + sec.id, async function() {
        this.saveDocumentSections();
      }.bind(this));
    },

    // ------ Cover letter ------

    async loadCoverletter() {
      var results = await Promise.all([
        fetch(API_BASE + '/api/settings?prefix=coverletter'),
        fetch(API_BASE + '/api/coverletter/sections'),
      ]);
      var settingsRes = results[0];
      var sectionsRes = results[1];
      if (settingsRes.ok) {
        var data = await settingsRes.json();
        var s = {};
        var entries = Object.entries(data);
        for (var i = 0; i < entries.length; i++) {
          s[entries[i][0].replace('coverletter.', '')] = entries[i][1];
        }
        this.coverletter.settings = s;
      }
      if (sectionsRes.ok) {
        this.coverletter.sections = await sectionsRes.json();
      }
    },

    autoSaveCoverletterSetting(field) {
      var self = this;
      this.debounce('cl.' + field, async function() {
        var body = {};
        body['coverletter.' + field] = self.coverletter.settings[field] || '';
        await fetch(API_BASE + '/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        self.flash('Saved', 'success');
      });
    },

    async addCoverletterSection() {
      var res = await fetch(API_BASE + '/api/coverletter/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '', body: '' }),
      });
      if (!res.ok) return;
      var data = await res.json();
      this.coverletter.sections.push({ id: data.id, title: '', body: '', sort_order: this.coverletter.sections.length });
    },

    autoSaveCoverletterSection(sec) {
      var self = this;
      this.debounce('clsec.' + sec.id, async function() {
        await fetch(API_BASE + '/api/coverletter/sections/' + sec.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: sec.title, body: sec.body }),
        });
        self.flash('Saved', 'success');
      });
    },

    async removeCoverletterSection(secId) {
      await fetch(API_BASE + '/api/coverletter/sections/' + secId, { method: 'DELETE' });
      this.coverletter.sections = this.coverletter.sections.filter(function(s) { return s.id !== secId; });
    },

    // ------ Compile & PDF ------

    async compile() {
      if (!this.serverConnected) { this.flash('Connect to server to compile', 'error'); return; }
      this.compiling = true;
      var name = this.activeDoc;
      try {
        var res = await fetch(API_BASE + '/api/compile/' + name, { method: 'POST' });
        var data = await res.json();
        if (data.success) {
          this.flash(name.charAt(0).toUpperCase() + name.slice(1) + ' compiled', 'success');
          var a = document.createElement('a');
          a.href = API_BASE + '/api/pdf/' + name + '?t=' + Date.now();
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

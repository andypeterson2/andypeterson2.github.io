function appPersonal() {
  return {
    personal: {},
    identityExtras: [],
    personalLinks: [],

    async loadPersonal() {
      const res = await cvApi.get(API.settings + '?prefix=personal');
      if (!res.ok) return;
      const data = await res.json();
      const p = {};
      for (const [key, value] of Object.entries(data)) {
        p[key.replace('personal.', '')] = value;
      }
      this.personal = p;
      this.loadIdentityExtras();
      this.loadPersonalLinks();
    },

    autoSavePersonal(field) {
      this.debounce('personal.' + field, async () => {
        await cvApi.patch(API.settings, { ['personal.' + field]: this.personal[field] || '' });
        this.saveState = 'saved';
      });
    },

    togglePhoto() {
      const enabled = this.personal.photoEnabled === '1' ? '0' : '1';
      this.personal.photoEnabled = enabled;
      cvApi.patch(API.settings, { 'personal.photoEnabled': enabled });
    },

    // ------ Identity extras (optional fields) ------

    loadIdentityExtras() {
      this.identityExtras = [];
      for (let i = 0; i < IDENTITY_EXTRAS.length; i++) {
        const ex = IDENTITY_EXTRAS[i];
        if (ex.key === 'photo') {
          if (this.personal.photoEnabled === '1') this.identityExtras.push('photo');
        } else if (this.personal[ex.key]) {
          this.identityExtras.push(ex.key);
        }
      }
    },

    addIdentityExtra(key) {
      if (this.identityExtras.indexOf(key) === -1) this.identityExtras.push(key);
    },

    async openAddIdentityExtra() {
      const avail = this.availableIdentityExtras();
      if (avail.length === 0) return;
      const result = await this.openModal('Add Field', [this._selectField('key', 'Field', avail)]);
      if (result && result.key) this.addIdentityExtra(result.key);
    },

    removeIdentityExtra(key) {
      this.identityExtras = this.identityExtras.filter(function(k) { return k !== key; });
      if (key === 'photo') {
        this.personal.photoEnabled = '0';
        this.personal.photoFile = '';
        cvApi.patch(API.settings, { 'personal.photoEnabled': '0', 'personal.photoFile': '' });
      } else {
        this.personal[key] = '';
        this.autoSavePersonal(key);
      }
    },

    identityExtra(key) {
      return IDENTITY_EXTRAS.find(function(c) { return c.key === key; });
    },

    availableIdentityExtras() {
      const added = this.identityExtras;
      return IDENTITY_EXTRAS.filter(function(c) { return added.indexOf(c.key) === -1; });
    },

    // ------ Social links (dynamic catalog) ------

    loadPersonalLinks() {
      this.personalLinks = [];
      for (let i = 0; i < SOCIAL_CATALOG.length; i++) {
        const cat = SOCIAL_CATALOG[i];
        if (cat.args === 2) {
          if (this.personal[cat.fields[0]] || this.personal[cat.fields[1]]) {
            this.personalLinks.push(cat.key);
          }
        } else {
          if (this.personal[cat.key]) this.personalLinks.push(cat.key);
        }
      }
    },

    addLink(key) {
      if (this.personalLinks.indexOf(key) === -1) this.personalLinks.push(key);
    },

    async openAddLink() {
      const avail = this.availableLinks();
      if (avail.length === 0) return;
      const result = await this.openModal('Add Link', [this._selectField('key', 'Link type', avail)]);
      if (result && result.key) this.addLink(result.key);
    },

    removeLink(key) {
      this.personalLinks = this.personalLinks.filter(function(k) { return k !== key; });
      const cat = SOCIAL_CATALOG.find(function(c) { return c.key === key; });
      if (!cat) return;
      if (cat.args === 2) {
        this.personal[cat.fields[0]] = '';
        this.personal[cat.fields[1]] = '';
        this.autoSavePersonal(cat.fields[0]);
        this.autoSavePersonal(cat.fields[1]);
      } else {
        this.personal[cat.key] = '';
        this.autoSavePersonal(cat.key);
      }
    },

    catalogEntry(key) {
      return SOCIAL_CATALOG.find(function(c) { return c.key === key; });
    },

    availableLinks() {
      const added = this.personalLinks;
      return SOCIAL_CATALOG.filter(function(c) { return added.indexOf(c.key) === -1; });
    },
  };
}

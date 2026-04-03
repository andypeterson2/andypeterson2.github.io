function appPersons() {
  return {
    persons: [],
    activePersonId: null,

    isActiveJaneDoe() {
      const current = this.persons.find(p => p.id === this.activePersonId);
      return current && current.name === 'Jane Doe';
    },

    async loadPersons() {
      try {
        const res = await cvApi.get(API.persons);
        if (!res.ok) return;
        const data = await res.json();
        this.persons = data.persons || [];
        this.activePersonId = data.activePersonId;
      } catch (e) { /* offline */ }
    },

    async openPerson() {
      if (!this.persons || this.persons.length === 0) return;
      const result = await this.openModal('Open Profile', [
        this._selectField('id', 'Profile', this.persons, { valueKey: 'id', labelKey: 'name', defaultValue: String(this.activePersonId) }),
      ]);
      if (!result) return;
      const id = parseInt(result.id);
      if (!isNaN(id) && id !== this.activePersonId) {
        await this.switchPerson(id);
      }
    },

    async handlePersonSelect(value) {
      const id = parseInt(value);
      if (!isNaN(id)) {
        await this.switchPerson(id);
      }
    },

    async createPerson() {
      const names = new Set(this.persons.map(p => p.name.toLowerCase()));
      const result = await this.openModal('New Person', [
        { name: 'name', label: 'Person name', value: '', validate: (v) => {
          const t = v.trim().toLowerCase();
          if (!t) return null;
          return names.has(t) ? 'Name already exists' : null;
        }},
      ]);
      if (!result || !result.name.trim()) return;
      const res = await cvApi.post(API.persons, { name: result.name.trim() });
      if (res.status === 409) { console.error('Name already exists'); this.saveState = 'error'; return; }
      if (!res.ok) { console.error('Failed to create'); this.saveState = 'error'; return; }
      const data = await res.json();
      await this.loadPersons();
      await this.switchPerson(data.id);
    },

    async renamePerson() {
      if (!this.activePersonId || this.isActiveJaneDoe()) return;
      const current = this.persons.find(p => p.id === this.activePersonId);
      const names = new Set(this.persons.map(p => p.name.toLowerCase()));
      if (current) names.delete(current.name.toLowerCase());
      const result = await this.openModal('Rename Profile', [
        { name: 'name', label: 'New name', value: current ? current.name : '', validate: (v) => {
          const t = v.trim().toLowerCase();
          if (!t) return null;
          return names.has(t) ? 'Name already exists' : null;
        }},
      ]);
      if (!result || !result.name.trim()) return;
      const res = await cvApi.put(API.person(this.activePersonId), { name: result.name.trim() });
      if (res.status === 409) { console.error('Name already exists'); this.saveState = 'error'; return; }
      if (!res.ok) { console.error('Failed to rename'); this.saveState = 'error'; return; }
      await this.loadPersons();
    },

    async resetJaneDoe() {
      if (!this.isActiveJaneDoe()) return;
      if (!confirm('Reset Jane Doe to default values?')) return;
      const res = await cvApi.post(API.import, JANE_DOE);
      if (!res.ok) { console.error('Failed to reset'); this.saveState = 'error'; return; }
      await this.init();
      this.saveState = 'saved';
    },

    async deletePerson() {
      if (!this.activePersonId || this.isActiveJaneDoe()) return;
      const current = this.persons.find(p => p.id === this.activePersonId);
      const result = await this.openModal('Delete Profile', [
        { name: 'confirm', label: 'Type "' + (current ? current.name : '') + '" to confirm', value: '' },
      ]);
      if (!result || result.confirm !== (current ? current.name : '')) return;
      const deleteId = this.activePersonId;
      const other = this.persons.find(p => p.id !== deleteId);
      if (other) await this.switchPerson(other.id);
      const res = await cvApi.del(API.person(deleteId));
      if (!res.ok) { console.error('Failed to delete'); this.saveState = 'error'; return; }
      await this.loadPersons();
    },

    async switchPerson(id) {
      if (id === this.activePersonId) return;
      if (this.dirty && !confirm('You have unsaved changes. Switch anyway?')) return;
      const res = await cvApi.post(API.personSwitch(id));
      if (!res.ok) { console.error('Failed to switch'); this.saveState = 'error'; return; }
      this.activePersonId = id;
      await this.init();
      this.dirty = false;
    },
  };
}

var LATEX_UNITS = ['pt', 'mm', 'cm', 'in', 'ex', 'em', 'bp', 'pc', 'dd', 'cc', 'sp', 'mu'];

var ACCENT_COLORS = [
  { key: 'awesome-emerald',   hex: '#00A388', label: 'Emerald' },
  { key: 'awesome-skyblue',   hex: '#0395DE', label: 'Sky Blue' },
  { key: 'awesome-red',       hex: '#DC3522', label: 'Red' },
  { key: 'awesome-pink',      hex: '#EF4089', label: 'Pink' },
  { key: 'awesome-orange',    hex: '#FF6138', label: 'Orange' },
  { key: 'awesome-nephritis', hex: '#27AE60', label: 'Nephritis' },
  { key: 'awesome-concrete',  hex: '#95A5A6', label: 'Concrete' },
  { key: 'awesome-darknight', hex: '#131A28', label: 'Dark Night' },
  { key: 'spinel',            hex: '#B21F5C', label: 'Spinel' },
];

function appStyle() {
  return {
    LATEX_UNITS: LATEX_UNITS,
    ACCENT_COLORS: ACCENT_COLORS,
    style: {
      pageSize: 'letterpaper',
      fontSize: '11pt',
      accentColor: 'spinel',
      fontFamily: 'source-sans-3',
      customHex: '',
    },
    spacing: {
      horizontalMargin: { num: 1.4, unit: 'cm' },
      marginTop: { num: 0.8, unit: 'cm' },
      marginBottom: { num: 1.8, unit: 'cm' },
      footskip: { num: 0.5, unit: 'cm' },
      headerLineGap: { num: 0.4, unit: 'mm' },
      headerAfterAddressSkip: { num: -0.5, unit: 'mm' },
      headerAfterSocialSkip: { num: 6, unit: 'mm' },
      headerAfterQuoteSkip: { num: 5, unit: 'mm' },
      sectionTopSkip: { num: 3, unit: 'mm' },
      sectionContentTopSkip: { num: 2.5, unit: 'mm' },
      contentTopAdjust: { num: -2.0, unit: 'mm' },
      itemsTopSkip: { num: -4.0, unit: 'mm' },
      itemsBottomSkip: { num: 1.0, unit: 'mm' },
      itemsLeftMargin: { num: 2, unit: 'ex' },
      skillsColSep: { num: 1, unit: 'ex' },
      paragraphTopAdjust: { num: -3, unit: 'mm' },
      paragraphBottomSkip: { num: 2, unit: 'mm' },
    },
    fonts: {
      headerNameSize: { num: 32, unit: 'pt' },
      headerPositionSize: { num: 7.6, unit: 'pt' },
      headerSocialSize: { num: 6.8, unit: 'pt' },
      secondaryTextSize: { num: 8, unit: 'pt' },
      contentTextSize: { num: 9, unit: 'pt' },
      itemTitleSize: { num: 10, unit: 'pt' },
      sectionTitleSize: { num: 16, unit: 'pt' },
      subsectionTitleSize: { num: 12, unit: 'pt' },
    },

    async loadStyle() {
      const res = await cvApi.get(API.settings + '?prefix=style');
      if (!res.ok) return;
      const data = await res.json();
      for (const [key, value] of Object.entries(data)) {
        const field = key.replace('style.', '');
        if (field in this.style) {
          this.style[field] = value;
        }
      }
    },

    autoSaveStyle(field) {
      this.debounce('style.' + field, async () => {
        await cvApi.patch(API.settings, { ['style.' + field]: this.style[field] || '' });
        this.saveState = 'saved';
      });
    },

    accentHex() {
      if (this.style.accentColor === 'custom') return this.style.customHex || '#000000';
      const entry = ACCENT_COLORS.find(c => c.key === this.style.accentColor);
      return entry ? entry.hex : '#000000';
    },

    setAccentColor(key) {
      this.style.accentColor = key;
      if (key !== 'custom') this.style.customHex = '';
      this.autoSaveStyle('accentColor');
    },

    applyCustomColor() {
      const hex = this.style.customHex.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        this.style.accentColor = 'custom';
        this.autoSaveStyle('accentColor');
        this.autoSaveStyle('customHex');
      }
    },

    async loadSpacing() {
      const res = await cvApi.get(API.settings + '?prefix=spacing');
      if (!res.ok) return;
      const data = await res.json();
      for (const [key, value] of Object.entries(data)) {
        const field = key.replace('spacing.', '');
        if (field in this.spacing && value && typeof value === 'object') {
          this.spacing[field] = value;
        }
      }
    },

    autoSaveSpacing(field) {
      this.debounce('spacing.' + field, async () => {
        await cvApi.patch(API.settings, { ['spacing.' + field]: this.spacing[field] });
        this.saveState = 'saved';
      });
    },

    async loadFonts() {
      const res = await cvApi.get(API.settings + '?prefix=fonts');
      if (!res.ok) return;
      const data = await res.json();
      for (const [key, value] of Object.entries(data)) {
        const field = key.replace('fonts.', '');
        if (field in this.fonts && value && typeof value === 'object') {
          this.fonts[field] = value;
        }
      }
    },

    autoSaveFonts(field) {
      this.debounce('fonts.' + field, async () => {
        await cvApi.patch(API.settings, { ['fonts.' + field]: this.fonts[field] });
        this.saveState = 'saved';
      });
    },
  };
}

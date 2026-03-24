/** @type {import('@storybook/html').Meta} */
export default {
  title: 'Components/Navigation',
};

export const Navbar = {
  render: () => {
    const nav = document.createElement('nav');
    nav.className = 'ui-navbar';
    nav.innerHTML = `
      <div class="ui-navbar-left">
        <a class="ui-navbar-brand" href="#">UI Kit</a>
      </div>
      <div class="ui-navbar-right">
        <a class="ui-navbar-link active" href="#">Home</a>
        <a class="ui-navbar-link" href="#">Projects</a>
        <a class="ui-navbar-link" href="#">About</a>
        <a class="ui-navbar-link" href="#">Contact</a>
      </div>
    `;
    return nav;
  },
};

export const Breadcrumbs = {
  render: () => {
    const nav = document.createElement('nav');
    nav.className = 'ui-breadcrumb';
    nav.innerHTML = `
      <a href="#">Home</a>
      <span class="ui-breadcrumb-sep">/</span>
      <a href="#">Projects</a>
      <span class="ui-breadcrumb-sep">/</span>
      <span>Current Page</span>
    `;
    return nav;
  },
};

export const Tabs = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="ui-tabs">
        <button class="ui-tab active">Overview</button>
        <button class="ui-tab">Details</button>
        <button class="ui-tab">Settings</button>
      </div>
    `;
    return wrap.firstElementChild;
  },
};

export const Pagination = {
  render: () => {
    const nav = document.createElement('nav');
    nav.className = 'ui-pagination';
    nav.innerHTML = `
      <button class="ui-page-btn">\u2190</button>
      <button class="ui-page-btn">1</button>
      <button class="ui-page-btn active">2</button>
      <button class="ui-page-btn">3</button>
      <button class="ui-page-btn">\u2192</button>
    `;
    return nav;
  },
};

/**
 * @jest-environment jsdom
 *
 * Unit tests for dashboard app.js
 */
const fs = require('fs');
const path = require('path');

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

const APP_JS = fs.readFileSync(
  path.resolve(__dirname, '..', 'static', 'js', 'app.js'),
  'utf-8'
);

// Minimal UIKit stub
function stubUIKit() {
  window.UIKit = {
    ICONS: { play: '<svg class="icon-play"></svg>' },
    initThemeToggle: jest.fn(),
    createLogger: function () {
      return jest.fn();
    },
  };
}

// Build the minimal DOM that app.js expects
function buildDOM() {
  document.body.innerHTML = `
    <div id="tab-bar-scroll"></div>
    <div id="tab-content"></div>
    <section id="welcome" style="display:block">Welcome</section>
    <button id="theme-toggle"></button>
    <button id="btn-refresh"></button>
    <div class="sidebar-scroll"></div>
    <span class="topbar-count"></span>
  `;
}

// Mock fetch globally
function mockFetch(response, ok = true) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    })
  );
}

function loadApp() {
  // Set API_BASE globally before loading app
  window.API_BASE = 'https://localhost:5050';
  eval(APP_JS);
}

describe('dashboard app.js', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
    delete window.UIKit;
    delete window.API_BASE;
    delete window.loadProjects;
  });

  describe('project loading', () => {
    test('loadProjects() fetches from API_BASE/api/projects', async () => {
      buildDOM();
      stubUIKit();
      mockFetch([]);
      loadApp();

      // loadProjects is called on init
      await new Promise(r => setTimeout(r, 0));

      expect(global.fetch).toHaveBeenCalledWith('https://localhost:5050/api/projects');
    });

    test('loadProjects() renders project list in sidebar', async () => {
      buildDOM();
      stubUIKit();
      const projects = [
        {
          name: 'test-project',
          has_git: true,
          git_branch: 'main',
          git_commit_count: 10,
          git_last_commit: 'fix bug',
          git_dirty: false,
          has_compose: true,
          has_dashboard_manifest: false,
          languages: ['Python'],
          dashboard_services: [
            { name: 'web', display_name: 'Web Server', compose_service: 'web', compose_file: 'docker-compose.yml', default_port: 8080 }
          ],
        },
      ];
      mockFetch(projects);
      loadApp();

      await new Promise(r => setTimeout(r, 10));

      const sidebar = document.querySelector('.sidebar-scroll');
      expect(sidebar.querySelector('[data-project="test-project"]')).not.toBeNull();
      expect(sidebar.textContent).toContain('test-project');
      expect(sidebar.textContent).toContain('Web Server');
    });

    test('loadProjects() updates project count', async () => {
      buildDOM();
      stubUIKit();
      mockFetch([
        { name: 'p1', has_git: false, has_compose: false, has_dashboard_manifest: false, languages: [], dashboard_services: [] },
        { name: 'p2', has_git: false, has_compose: false, has_dashboard_manifest: false, languages: [], dashboard_services: [] },
      ]);
      loadApp();

      await new Promise(r => setTimeout(r, 10));

      expect(document.querySelector('.topbar-count').textContent).toBe('2 projects');
    });

    test('loadProjects() shows empty state when no projects', async () => {
      buildDOM();
      stubUIKit();
      mockFetch([]);
      loadApp();

      await new Promise(r => setTimeout(r, 10));

      const sidebar = document.querySelector('.sidebar-scroll');
      expect(sidebar.textContent).toContain('No projects found');
    });

    test('loadProjects() shows error on fetch failure', async () => {
      buildDOM();
      stubUIKit();
      global.fetch = jest.fn(() => Promise.reject(new Error('Connection refused')));
      loadApp();

      await new Promise(r => setTimeout(r, 10));

      const sidebar = document.querySelector('.sidebar-scroll');
      expect(sidebar.textContent).toContain('Cannot reach backend');
      expect(sidebar.textContent).toContain('Connection refused');
    });
  });

  describe('refresh button', () => {
    test('refresh button calls loadProjects again', async () => {
      buildDOM();
      stubUIKit();
      mockFetch([]);
      loadApp();

      await new Promise(r => setTimeout(r, 10));

      // Reset fetch mock and click refresh
      global.fetch.mockClear();
      mockFetch([{ name: 'new-project', has_git: false, has_compose: false, has_dashboard_manifest: false, languages: [], dashboard_services: [] }]);
      document.getElementById('btn-refresh').click();

      await new Promise(r => setTimeout(r, 10));

      expect(global.fetch).toHaveBeenCalledWith('https://localhost:5050/api/projects');
    });
  });

  describe('service tab lifecycle', () => {
    test('clicking a service button creates a tab and panel', async () => {
      buildDOM();
      stubUIKit();
      const projects = [{
        name: 'myproject',
        has_git: false, has_compose: true, has_dashboard_manifest: false,
        languages: [],
        dashboard_services: [
          { name: 'api', display_name: 'API', compose_service: 'api', compose_file: 'docker-compose.yml', default_port: 3000 }
        ],
      }];
      mockFetch(projects);
      loadApp();

      await new Promise(r => setTimeout(r, 10));

      // Now click the start button — mock the POST response
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ status: 'started' }),
          text: () => Promise.resolve('{"status":"started"}'),
        })
      );

      const startBtn = document.querySelector('.svc-start-btn');
      expect(startBtn).not.toBeNull();
      startBtn.click();

      // Tab and panel should be created
      const tab = document.querySelector('#tab-bar-scroll .tab-item');
      expect(tab).not.toBeNull();
      expect(tab.querySelector('.tab-label').textContent).toBe('API');

      const panel = document.querySelector('.service-panel');
      expect(panel).not.toBeNull();
      expect(panel.querySelector('.service-panel-title').textContent).toBe('API');

      // Welcome should be hidden
      expect(document.getElementById('welcome').style.display).toBe('none');
    });

    test('closing a tab removes it and shows welcome if last tab', async () => {
      buildDOM();
      stubUIKit();
      mockFetch([{
        name: 'proj',
        has_git: false, has_compose: true, has_dashboard_manifest: false,
        languages: [],
        dashboard_services: [
          { name: 'svc', display_name: 'Service', compose_service: 'svc', compose_file: 'docker-compose.yml', default_port: 0 }
        ],
      }]);
      loadApp();

      await new Promise(r => setTimeout(r, 10));

      // Start a service
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true, status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ status: 'started' }),
          text: () => Promise.resolve('{}'),
        })
      );

      document.querySelector('.svc-start-btn').click();
      expect(document.querySelectorAll('.tab-item').length).toBe(1);

      // Close the tab
      document.querySelector('.tab-close').click();

      await new Promise(r => setTimeout(r, 10));

      expect(document.querySelectorAll('.tab-item').length).toBe(0);
      expect(document.getElementById('welcome').style.display).not.toBe('none');
    });
  });

  describe('window.loadProjects exposure', () => {
    test('loadProjects is exposed on window for connect widget', () => {
      buildDOM();
      stubUIKit();
      mockFetch([]);
      loadApp();

      expect(typeof window.loadProjects).toBe('function');
    });
  });
});

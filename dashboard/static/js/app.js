/* ── Dashboard app.js — Service tab manager ─────────────────── */
(function () {
  "use strict";

  // ── Icons & theme ───────────────────────────────────────────
  document.querySelectorAll("[data-icon]").forEach(function (el) {
    var name = el.dataset.icon;
    if (window.UIKit && UIKit.ICONS[name]) el.outerHTML = UIKit.ICONS[name];
  });

  var toggle = document.getElementById("theme-toggle");
  if (toggle && window.UIKit) UIKit.initThemeToggle(toggle);

  // ── State ───────────────────────────────────────────────────
  var nextId = 1;
  var tabs = [];        // { id, key, displayName, project, service, composeService, composeFile, port, tabEl, panelEl, logTimer, logger }
  var activeTabId = null;

  var tabBarScroll = document.getElementById("tab-bar-scroll");
  var tabContent   = document.getElementById("tab-content");
  var welcome      = document.getElementById("welcome");

  // Duplicate naming helpers
  function tabsForService(key) {
    return tabs.filter(function (t) { return t.key === key; });
  }

  function nextInstanceNum(key) {
    var used = tabs
      .filter(function (t) { return t.key === key; })
      .map(function (t) { return t.instanceNum; });
    var n = 1;
    while (used.indexOf(n) !== -1) n++;
    return n;
  }

  function tabLabel(displayName, instanceNum, totalOpen) {
    if (totalOpen <= 1) return displayName;
    return displayName + " (" + instanceNum + ")";
  }

  function refreshLabels(key) {
    var matching = tabsForService(key);
    matching.forEach(function (t) {
      var span = t.tabEl.querySelector(".tab-label");
      span.textContent = tabLabel(t.displayName, t.instanceNum, matching.length);
    });
  }

  // ── API helpers ─────────────────────────────────────────────
  function parseJSON(r) {
    var ct = r.headers.get("content-type") || "";
    if (ct.indexOf("application/json") !== -1) return r.json();
    return r.text().then(function (t) { return { error: t.slice(0, 200) }; });
  }

  function apiPost(url, body) {
    return fetch(API_BASE + url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(parseJSON);
  }

  function apiGet(url) {
    return fetch(API_BASE + url).then(parseJSON);
  }

  // ── Open a service tab ──────────────────────────────────────
  function openServiceTab(btn) {
    var project        = btn.dataset.project;
    var service        = btn.dataset.service;
    var displayName    = btn.dataset.displayName;
    var composeService = btn.dataset.composeService;
    var composeFile    = btn.dataset.composeFile;
    var port           = btn.dataset.port;
    var key            = project + "/" + service;

    var id = nextId++;
    var instanceNum = nextInstanceNum(key);

    // Build tab panel with header + log terminal
    var panel = document.createElement("section");
    panel.className = "service-panel";
    panel.dataset.tabId = id;
    panel.innerHTML =
      '<div class="service-panel-header">' +
        '<div class="service-panel-info">' +
          '<h2 class="service-panel-title">' + displayName + '</h2>' +
          '<span class="ui-badge">' + project + '</span>' +
          (port ? '<span class="ui-badge ui-badge-accent">:' + port + '</span>' : '') +
        '</div>' +
        '<div class="service-panel-actions">' +
          '<span class="service-status" data-tab-id="' + id + '">Starting...</span>' +
          '<button class="btn btn-xs btn-danger svc-stop-btn" data-tab-id="' + id + '">' +
            'Stop' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="log-terminal" id="log-' + id + '"></div>';

    // Create tab button
    var tab = document.createElement("button");
    tab.className = "tab-item";
    tab.dataset.tabId = id;
    tab.innerHTML =
      '<span class="sidebar-dot dot-starting"></span>' +
      '<span class="tab-label"></span>' +
      '<span class="tab-close" title="Close">&times;</span>';

    // Tab click → activate
    tab.addEventListener("click", function (e) {
      if (e.target.classList.contains("tab-close")) return;
      activateTab(id);
    });

    // Close button → stop + close
    tab.querySelector(".tab-close").addEventListener("click", function (e) {
      e.stopPropagation();
      stopAndCloseTab(id);
    });

    // Middle-click to close
    tab.addEventListener("auxclick", function (e) {
      if (e.button === 1) { e.preventDefault(); stopAndCloseTab(id); }
    });

    // Stop button in panel
    panel.querySelector(".svc-stop-btn").addEventListener("click", function () {
      stopAndCloseTab(id);
    });

    var entry = {
      id: id,
      key: key,
      displayName: displayName,
      project: project,
      service: service,
      composeService: composeService,
      composeFile: composeFile,
      port: port,
      instanceNum: instanceNum,
      tabEl: tab,
      panelEl: panel,
      logTimer: null,
      logger: null,
      lastLogLen: 0,
    };
    tabs.push(entry);

    tabBarScroll.appendChild(tab);
    tabContent.appendChild(panel);

    refreshLabels(key);
    activateTab(id);

    // Init log terminal
    var logEl = document.getElementById("log-" + id);
    if (window.UIKit && UIKit.createLogger) {
      entry.logger = UIKit.createLogger(logEl, 500);
      entry.logger("Starting " + displayName + "...", "ok");
    }

    // Start the Docker service
    apiPost("/api/services/start", {
      project: project,
      service: service,
      compose_service: composeService,
      compose_file: composeFile,
    }).then(function (res) {
      var statusEl = panel.querySelector(".service-status");
      var dotEl = tab.querySelector(".sidebar-dot");
      if (res.error) {
        statusEl.textContent = "Error";
        statusEl.classList.add("status-error");
        dotEl.className = "sidebar-dot dot-error";
        if (entry.logger) entry.logger("Error: " + res.error, "err");
        if (res.stderr && entry.logger) entry.logger(res.stderr, "err");
      } else {
        statusEl.textContent = "Running";
        statusEl.classList.add("status-running");
        dotEl.className = "sidebar-dot dot-running";
        if (entry.logger) entry.logger("Service started", "ok");
        // Start log polling
        startLogPolling(entry);
      }
    }).catch(function (err) {
      if (entry.logger) entry.logger("Network error: " + err.message, "err");
    });
  }

  // ── Log polling ─────────────────────────────────────────────
  function startLogPolling(entry) {
    function poll() {
      apiGet("/api/services/" + entry.project + "/" + entry.service + "/logs?tail=200")
        .then(function (res) {
          if (res.logs && entry.logger) {
            var lines = res.logs.split("\n").filter(Boolean);
            // Only append new lines
            if (lines.length > entry.lastLogLen) {
              var newLines = lines.slice(entry.lastLogLen);
              newLines.forEach(function (line) {
                var level = "";
                if (/error|exception|traceback/i.test(line)) level = "err";
                else if (/warn/i.test(line)) level = "warn";
                entry.logger(line, level);
              });
              entry.lastLogLen = lines.length;
            }
          }
        })
        .catch(function () { /* ignore polling errors */ });
    }
    poll();
    entry.logTimer = setInterval(poll, 3000);
  }

  // ── Activate tab ────────────────────────────────────────────
  function activateTab(id) {
    activeTabId = id;
    tabs.forEach(function (t) {
      var isActive = t.id === id;
      t.tabEl.classList.toggle("active", isActive);
      t.panelEl.style.display = isActive ? "flex" : "none";
    });
    welcome.style.display = "none";

    var entry = tabs.find(function (t) { return t.id === id; });
    if (entry) entry.tabEl.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  // ── Stop & close tab ───────────────────────────────────────
  function stopAndCloseTab(id) {
    var idx = tabs.findIndex(function (t) { return t.id === id; });
    if (idx === -1) return;

    var entry = tabs[idx];

    // Stop polling
    if (entry.logTimer) clearInterval(entry.logTimer);

    // Stop the Docker service
    apiPost("/api/services/stop", {
      project: entry.project,
      service: entry.service,
      compose_service: entry.composeService,
      compose_file: entry.composeFile,
    }).catch(function () { /* best effort */ });

    var key = entry.key;
    entry.tabEl.remove();
    entry.panelEl.remove();
    tabs.splice(idx, 1);

    refreshLabels(key);

    if (activeTabId === id) {
      if (tabs.length === 0) {
        activeTabId = null;
        welcome.style.display = "";
      } else {
        var newIdx = Math.min(idx, tabs.length - 1);
        activateTab(tabs[newIdx].id);
      }
    }
  }

  // ── Bind start buttons (static or dynamically created) ─────
  function bindStartButtons(root) {
    (root || document).querySelectorAll(".svc-start-btn").forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.querySelectorAll("[data-icon]").forEach(function (el) {
        var name = el.dataset.icon;
        if (window.UIKit && UIKit.ICONS[name]) el.outerHTML = UIKit.ICONS[name];
      });
      btn.addEventListener("click", function () {
        openServiceTab(btn);
      });
    });
  }

  // ── Load projects from API (for static-hosted frontend) ───
  function loadProjects() {
    apiGet("/api/projects")
      .then(function (projects) {
        if (!Array.isArray(projects)) return;

        var sidebar = document.querySelector(".sidebar-scroll");
        if (!sidebar) return;

        // Update project count
        var countEl = document.querySelector(".topbar-count");
        if (countEl) countEl.textContent = projects.length + " projects";

        // Clear existing content
        sidebar.innerHTML = "";

        if (projects.length === 0) {
          sidebar.innerHTML =
            '<div class="empty-state">' +
              "<p>No projects found.</p>" +
              '<p class="text-muted">Check that the backend is running.</p>' +
            "</div>";
          return;
        }

        projects.forEach(function (p) {
          var details = document.createElement("details");
          details.className = "ui-collapsible project-collapsible";
          details.dataset.project = p.name;

          // Determine dot class
          var dotClass = "dot-bare";
          if (p.has_dashboard_manifest) dotClass = "dot-running";
          else if (p.has_compose) dotClass = "dot-compose";
          else if (p.has_git) dotClass = "dot-git";

          var summaryHtml =
            '<span class="sidebar-dot ' + dotClass + '"></span>' +
            '<span class="sidebar-name">' + p.name + "</span>";
          if (p.git_dirty) summaryHtml += '<span class="ui-badge ui-badge-warn">M</span>';

          var summary = document.createElement("summary");
          summary.innerHTML = summaryHtml;
          details.appendChild(summary);

          var body = document.createElement("div");
          body.className = "ui-collapsible-body project-info";

          if (p.description) {
            body.innerHTML += '<p class="project-desc">' + p.description + "</p>";
          }

          if (p.has_git) {
            body.innerHTML +=
              '<div class="info-section">' +
                '<div class="info-row"><span class="info-label">Branch</span><span class="info-value">' + (p.git_branch || "") + "</span></div>" +
                '<div class="info-row"><span class="info-label">Commits</span><span class="info-value">' + (p.git_commit_count || 0) + "</span></div>" +
                '<div class="info-row"><span class="info-label">Last</span><span class="info-value info-truncate">' + (p.git_last_commit || "") + "</span></div>" +
                (p.git_remote ? '<div class="info-row"><span class="info-label">Remote</span><span class="info-value info-truncate remote-url">' + p.git_remote + "</span></div>" : "") +
              "</div>";
          }

          if (p.languages && p.languages.length) {
            var tags = '<div class="info-tags">';
            p.languages.forEach(function (lang) {
              tags += '<span class="ui-badge">' + lang + "</span>";
            });
            tags += "</div>";
            body.innerHTML += tags;
          }

          // Service buttons
          var services = p.dashboard_services || [];
          if (services.length) {
            var btns = '<div class="service-buttons">';
            services.forEach(function (svc) {
              btns +=
                '<button class="btn btn-xs btn-primary svc-start-btn"' +
                ' data-project="' + p.name + '"' +
                ' data-service="' + svc.name + '"' +
                ' data-display-name="' + (svc.display_name || svc.name) + '"' +
                ' data-compose-service="' + (svc.compose_service || svc.name) + '"' +
                ' data-compose-file="' + (svc.compose_file || "docker-compose.yml") + '"' +
                ' data-port="' + (svc.default_port || "") + '">' +
                '<span data-icon="play"></span> ' + (svc.display_name || svc.name) +
                "</button>";
            });
            btns += "</div>";
            body.innerHTML += btns;
          } else if (p.compose_services && p.compose_services.length) {
            var btns2 = '<div class="service-buttons">';
            p.compose_services.forEach(function (svc) {
              btns2 +=
                '<button class="btn btn-xs btn-primary svc-start-btn"' +
                ' data-project="' + p.name + '"' +
                ' data-service="' + svc + '"' +
                ' data-display-name="' + svc + '"' +
                ' data-compose-service="' + svc + '"' +
                ' data-compose-file="docker-compose.yml"' +
                ' data-port="">' +
                '<span data-icon="play"></span> ' + svc +
                "</button>";
            });
            btns2 += "</div>";
            body.innerHTML += btns2;
          }

          details.appendChild(body);
          sidebar.appendChild(details);
        });

        // Bind newly created buttons
        bindStartButtons(sidebar);
      })
      .catch(function (err) {
        var sidebar = document.querySelector(".sidebar-scroll");
        if (sidebar) {
          sidebar.innerHTML =
            '<div class="empty-state">' +
              "<p>Cannot reach backend.</p>" +
              '<p class="text-muted">' + err.message + "</p>" +
            "</div>";
        }
      });
  }

  // Bind any server-rendered buttons that already exist
  bindStartButtons();

  // Load projects from API (static frontend needs this; server-rendered pages get a no-op refresh)
  loadProjects();

  // ── Refresh button ──────────────────────────────────────────
  var refreshBtn = document.getElementById("btn-refresh");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function () {
      loadProjects();
    });
  }
})();

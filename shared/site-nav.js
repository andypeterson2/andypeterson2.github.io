(function () {
  "use strict";

  // Inject body padding for the fixed navbar (44px default, increases if bottom tray)
  var style = document.createElement("style");
  style.textContent = "body { padding-top: 44px !important; }";
  document.head.appendChild(style);

  function buildIcon(faClass) {
    var span = document.createElement("span");
    span.className = "icon";
    var i = document.createElement("i");
    i.className = faClass;
    span.appendChild(i);
    return span;
  }

  function build(apps) {
    var currentPath = location.pathname;
    // Normalize trailing slash
    if (currentPath !== "/" && !currentPath.endsWith("/")) {
      currentPath += "/";
    }

    var root = apps.find(function (a) { return a.path === "/"; });
    var pinned = apps.filter(function (a) { return a.path !== "/" && a.pin === "left"; });
    var others = apps.filter(function (a) { return a.path !== "/" && a.pin !== "left"; });
    var currentApp = apps.find(function (a) { return a.path === currentPath; });

    // --- Wrapper: holds navbar + trays ---
    var wrapper = document.createElement("div");
    wrapper.className = "ui-navbar-wrapper";

    // --- Build <nav class="ui-navbar"> ---
    var nav = document.createElement("nav");
    nav.className = "ui-navbar";
    nav.setAttribute("aria-label", "Site navigation");

    // Brand (home link — always pinned left)
    var brand = document.createElement("a");
    brand.className = "ui-navbar-brand";
    brand.href = "/";
    if (root && root.icon) {
      brand.appendChild(buildIcon(root.icon));
      brand.appendChild(document.createTextNode(" " + (root.title || "Home")));
    } else {
      brand.textContent = root ? root.title : "Home";
    }
    if (currentPath === "/") brand.classList.add("active");
    nav.appendChild(brand);

    // Pinned links (always visible, placed right after brand)
    pinned.forEach(function (app) {
      var a = document.createElement("a");
      a.href = app.path;
      a.className = "ui-navbar-pinned";
      if (app.icon) {
        a.appendChild(buildIcon(app.icon));
        a.appendChild(document.createTextNode(" " + app.title));
      } else {
        a.textContent = app.title;
      }
      if (currentPath === app.path) a.classList.add("active");
      nav.appendChild(a);
    });

    // Menu container
    var menu = document.createElement("div");
    menu.className = "ui-navbar-menu";

    others.forEach(function (app) {
      var a = document.createElement("a");
      a.href = app.path;
      if (app.icon) {
        a.appendChild(buildIcon(app.icon));
        a.appendChild(document.createTextNode(" " + app.title));
      } else {
        a.textContent = app.title;
      }
      if (currentPath === app.path) a.className = "active";
      menu.appendChild(a);
    });

    nav.appendChild(menu);

    // Hamburger toggle button
    var toggle = document.createElement("button");
    toggle.className = "ui-navbar-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Toggle navigation");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = "&#9776;";
    nav.appendChild(toggle);

    // Toggle behaviour
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    // Close menu on link click
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        menu.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    // Close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("open")) {
        menu.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    wrapper.appendChild(nav);

    // --- Left tray (structural placeholder) ---
    var leftTray = document.createElement("div");
    leftTray.className = "ui-navbar-tray--left";
    leftTray.setAttribute("aria-label", "Left tray");
    wrapper.appendChild(leftTray);

    // --- Right tray (structural placeholder) ---
    var rightTray = document.createElement("div");
    rightTray.className = "ui-navbar-tray--right";
    rightTray.setAttribute("aria-label", "Right tray");
    wrapper.appendChild(rightTray);

    // --- Bottom tray: backend connection (only if current app has a backend) ---
    var hasBottomTray = false;
    if (currentApp && currentApp.backend) {
      hasBottomTray = true;
      var bottomTray = document.createElement("div");
      bottomTray.className = "ui-navbar-tray--bottom";
      bottomTray.setAttribute("aria-label", "Backend connection");

      // Service label
      var serviceLabel = document.createElement("span");
      serviceLabel.className = "tray-service-label";
      serviceLabel.textContent = currentApp.backend.service;
      bottomTray.appendChild(serviceLabel);

      // Connect widget container
      var connectEl = document.createElement("div");
      connectEl.id = "navbar-backend-connect";
      bottomTray.appendChild(connectEl);

      wrapper.appendChild(bottomTray);

      // Initialize connect widget once UIKit is available
      initConnectWhenReady(connectEl, currentApp.backend);
    }

    // Insert wrapper at top of body
    document.body.prepend(wrapper);

    // Adjust body padding based on bottom tray
    if (hasBottomTray) {
      // Bottom tray is approximately 40px
      style.textContent = "body { padding-top: 84px !important; }";
    }

    // Push down the main page's existing mobile-nav if present
    var existingMobileNav = document.querySelector(".mobile-nav");
    if (existingMobileNav) {
      var navbarHeight = hasBottomTray ? 84 : 44;
      existingMobileNav.style.top = navbarHeight + "px";
      style.textContent = "body { padding-top: " + (navbarHeight + 44) + "px !important; }";
      var mobileMenu = document.querySelector(".mobile-nav-menu");
      if (mobileMenu) mobileMenu.style.top = (navbarHeight + 44) + "px";
    }
  }

  /**
   * Wait for UIKit and ServiceConfig to be available, then init the connect widget.
   */
  function initConnectWhenReady(el, backend) {
    var attempts = 0;
    function tryInit() {
      if (window.UIKit && window.UIKit.initConnect && window.ServiceConfig) {
        var defaultUrl = "https://localhost:" + backend.defaultPort;
        var resolvedUrl = ServiceConfig.resolveBackend
          ? ServiceConfig.resolveBackend(backend.service, defaultUrl)
          : ServiceConfig.get(backend.service, defaultUrl);

        // Parse host/port from resolved URL
        var host = "localhost";
        var port = backend.defaultPort;
        try {
          var parsed = new URL(resolvedUrl);
          host = parsed.hostname;
          port = parseInt(parsed.port, 10) || backend.defaultPort;
        } catch (_) {}

        var widget = UIKit.initConnect(el, {
          service: backend.service,
          defaultHost: host,
          defaultPort: port,
          label: ""
        });

        // Dispatch event so pages can hook into the shared widget
        document.dispatchEvent(new CustomEvent("navbar:connect-ready", {
          detail: { service: backend.service, widget: widget }
        }));
      } else if (++attempts < 50) {
        setTimeout(tryInit, 100);
      }
    }
    tryInit();
  }

  function init() {
    fetch("/site-manifest.json")
      .then(function (r) { return r.json(); })
      .then(function (data) { build(data.apps); })
      .catch(function () { /* manifest unavailable — degrade silently */ });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

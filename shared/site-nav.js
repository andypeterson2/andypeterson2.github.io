(function () {
  "use strict";

  // Inject body padding for the fixed navbar (44px)
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

    // Insert at top of body
    document.body.prepend(nav);

    // Push down the main page's existing mobile-nav if present
    var existingMobileNav = document.querySelector(".mobile-nav");
    if (existingMobileNav) {
      existingMobileNav.style.top = "44px";
      style.textContent = "body { padding-top: 88px !important; }";
      // Also push the mobile menu dropdown
      var mobileMenu = document.querySelector(".mobile-nav-menu");
      if (mobileMenu) mobileMenu.style.top = "88px";
    }
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

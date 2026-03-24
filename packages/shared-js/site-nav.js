(function () {
  "use strict";

  /* ── Project list for the Projects submenu ── */
  var projectLinks = [
    { href: "/projects/quantum-video-chat/", label: "Quantum Video Chat" },
    { href: "/nonogram/website/", label: "Quantum Nonogram Solver" },
    { href: "/classifiers/", label: "Quantum Protein Kernel" },
    { href: "/tech-tree/website/", label: "Tech Tree" },
    { href: "/task-randomizer/", label: "Task Randomizer" },
    { href: "/dashboard/website/", label: "Portfolio Dashboard" },
  ];

  /* ── Derive breadcrumb label from the current page's <title> ── */
  function getPageLabel() {
    var t = document.title || "";
    // Strip " — Dev Environment" or similar suffixes
    return t.split(/\s*[—–|]\s*/)[0].trim() || "Page";
  }

  /* ── Build the system.css role="menu-bar" nav matching Nav.astro ── */
  function build() {
    var currentPath = location.pathname;

    // --- Wrapper ---
    var wrapper = document.createElement("div");
    wrapper.className = "ui-navbar-wrapper";

    // --- system.css nav with role="menu-bar" ---
    var nav = document.createElement("nav");
    nav.className = "ui-navbar site-navbar";
    nav.setAttribute("aria-label", "Site navigation");

    var ul = document.createElement("ul");
    ul.setAttribute("role", "menu-bar");

    // 1. Heart icon (home link)
    var heartLi = document.createElement("li");
    heartLi.setAttribute("role", "menu-item");
    heartLi.setAttribute("aria-haspopup", "false");
    heartLi.className = "heart-item";
    var heartA = document.createElement("a");
    heartA.href = "/";
    var heartImg = document.createElement("img");
    heartImg.src = "/icons/heart.svg";
    heartImg.alt = "Home";
    heartImg.className = "heart-icon";
    heartA.appendChild(heartImg);
    heartLi.appendChild(heartA);
    ul.appendChild(heartLi);

    // 2. About (submenu)
    var aboutLi = document.createElement("li");
    aboutLi.setAttribute("role", "menu-item");
    aboutLi.setAttribute("aria-haspopup", "true");
    aboutLi.tabIndex = 0;
    aboutLi.textContent = "About";
    var aboutUl = document.createElement("ul");
    aboutUl.setAttribute("role", "menu");
    [
      { href: "/about", label: "Intro" },
      { href: "/about", label: "Resume" },
      { href: "/about", label: "CV" },
    ].forEach(function (item) {
      var li = document.createElement("li");
      li.setAttribute("role", "menu-item");
      var a = document.createElement("a");
      a.href = item.href;
      a.textContent = item.label;
      li.appendChild(a);
      aboutUl.appendChild(li);
    });
    aboutLi.appendChild(aboutUl);
    ul.appendChild(aboutLi);

    // 3. Projects (submenu)
    var projectsLi = document.createElement("li");
    projectsLi.setAttribute("role", "menu-item");
    projectsLi.setAttribute("aria-haspopup", "true");
    projectsLi.tabIndex = 0;
    projectsLi.textContent = "Projects";
    var projectsUl = document.createElement("ul");
    projectsUl.setAttribute("role", "menu");
    projectLinks.forEach(function (item) {
      var li = document.createElement("li");
      li.setAttribute("role", "menu-item");
      var a = document.createElement("a");
      a.href = item.href;
      a.textContent = item.label;
      li.appendChild(a);
      projectsUl.appendChild(li);
    });
    projectsLi.appendChild(projectsUl);
    ul.appendChild(projectsLi);

    // 4. Contact
    var contactLi = document.createElement("li");
    contactLi.setAttribute("role", "menu-item");
    contactLi.setAttribute("aria-haspopup", "false");
    var contactA = document.createElement("a");
    contactA.href = "/contact";
    contactA.textContent = "Contact";
    contactLi.appendChild(contactA);
    ul.appendChild(contactLi);

    nav.appendChild(ul);
    wrapper.appendChild(nav);

    // --- Breadcrumb tray ---
    var tray = document.createElement("div");
    tray.className = "ui-navbar-tray--bottom";
    var bc = document.createElement("nav");
    bc.className = "ui-breadcrumb";
    bc.setAttribute("aria-label", "Breadcrumb");

    var homeA = document.createElement("a");
    homeA.href = "/";
    homeA.textContent = "Home";
    bc.appendChild(homeA);

    // Add "Projects" crumb
    var sep1 = document.createElement("span");
    sep1.className = "ui-breadcrumb-sep";
    bc.appendChild(sep1);
    var projA = document.createElement("a");
    projA.href = "/projects";
    projA.textContent = "Projects";
    bc.appendChild(projA);

    // Add current page crumb
    var sep2 = document.createElement("span");
    sep2.className = "ui-breadcrumb-sep";
    bc.appendChild(sep2);
    var currentSpan = document.createElement("span");
    currentSpan.className = "ui-breadcrumb-current";
    currentSpan.textContent = getPageLabel();
    bc.appendChild(currentSpan);

    tray.appendChild(bc);
    wrapper.appendChild(tray);

    // Insert at top of body
    document.body.prepend(wrapper);
  }

  /* ── Inline styles to match Nav.astro exactly ── */
  function injectStyles() {
    var style = document.createElement("style");
    style.textContent = [
      "html { background: #eee url('/bg-pattern.svg') repeat !important; background-size: 32px 32px !important; image-rendering: pixelated; }",
      ".site-navbar { border-bottom: none; padding-top: 4px; padding-bottom: 4px; }",
      ".site-navbar [role=\"menu-item\"] { font-weight: 400; }",
      ".heart-icon { width: 24px; height: 24px; display: block; }",
      ".heart-item:hover .heart-icon { filter: invert(1); }",
      ".ui-navbar-tray--bottom { background: #fff; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 12px; display: flex; align-items: center; font-size: 14px; }",
    ].join("\n");
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    build();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

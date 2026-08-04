/**
 * @file Portal bootstrap for the classifier embed.
 *
 * The classifier frontend was originally server-rendered: a Flask template
 * injected `API_BASE` (the backend origin) and `UI_CONFIG` (the active
 * dataset's config) as globals that app.js reads at module-load time. As a
 * static portal embed there is no template, so both were undefined and app.js
 * threw a ReferenceError at load (`const BASE = API_BASE + …`). This file
 * supplies safe defaults so those eager reads never throw; the real backend
 * URL is resolved via ServiceConfig here and refreshed on `navbar:connect`
 * (app.js keeps its `base()` prefix live against `window.API_BASE`).
 *
 * Load order: this script must run BEFORE app.js. It is defensive about
 * ServiceConfig, which is mounted globally by ServerConnectModal and may load
 * after this file — when absent, navbar:connect fills API_BASE in later.
 */
"use strict";

// Datasets the in-browser demo can switch between with no backend. Each carries
// the UI shape app.js reads through UI_CONFIG; the trained weights (and, for
// tabular datasets, feature ranges) live in /classifiers/models/<name>.json.
window.CLASSIFIER_DATASETS = window.CLASSIFIER_DATASETS || [
  {
    name: "mnist",
    display_name: "MNIST Handwritten Digits",
    input_type: "image",
    class_labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  },
  {
    name: "iris",
    display_name: "Iris Flower Classification",
    input_type: "tabular",
    class_labels: ["setosa", "versicolor", "virginica"],
    features: ["sepal_length", "sepal_width", "petal_length", "petal_width"],
  },
];

// The dataset shown on load (the draw-to-predict MNIST canvas).
window.UI_CONFIG = window.UI_CONFIG || window.CLASSIFIER_DATASETS[0];

// Backend origin, resolved the same way the rest of the portal resolves it
// (?classifiers= / ?backend= / localStorage / default). navbar:connect will
// overwrite this with the user-chosen URL.
window.API_BASE =
  window.API_BASE ||
  (window.ServiceConfig
    ? window.ServiceConfig.resolveBackend("classifiers", "http://localhost:5001")
    : "");

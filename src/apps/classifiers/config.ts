/**
 * Portal bootstrap for the classifier embed.
 *
 * The classifier frontend was originally server-rendered: a Flask template
 * injected `API_BASE` (the backend origin) and `UI_CONFIG` (the active
 * dataset's config) as globals that the app reads at load time. As a static
 * portal embed there is no template, so this module supplies them: the real
 * backend URL is resolved via ServiceConfig and refreshed on `navbar:connect`
 * (the app keeps its `base()` prefix live against `window.API_BASE`).
 *
 * Side-effect module — the entry imports it BEFORE app.ts.
 */

import { ServiceConfig } from '../shared/service-config';
import { SitePass } from '../shared/pass';

export interface DatasetDef {
  name: string;
  display_name: string;
  input_type: 'image' | 'tabular';
  class_labels: string[];
  features?: string[];
  /** In-browser model assets for the demo tier; the first is the primary
   *  (full-class) model that also defines the input form. */
  local_models: string[];
}

// Datasets the in-browser demo can switch between with no backend. Each carries
// the UI shape app.ts reads through UI_CONFIG; the trained weights (and, for
// tabular datasets, feature ranges) live in /classifiers/models/<name>.json.
export const CLASSIFIER_DATASETS: DatasetDef[] = [
  {
    name: 'mnist',
    display_name: 'MNIST Handwritten Digits',
    input_type: 'image',
    class_labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    local_models: ['mnist', 'qsvm-mnist'],
  },
  {
    name: 'iris',
    display_name: 'Iris Flower Classification',
    input_type: 'tabular',
    class_labels: ['setosa', 'versicolor', 'virginica'],
    features: ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'],
    local_models: ['iris', 'qsvm-iris'],
  },
  {
    name: 'bb84',
    display_name: 'BB84 Eavesdropper Detection',
    input_type: 'tabular',
    class_labels: ['clean', 'eavesdropped'],
    features: ['qber', 'sifted_key_rate'],
    local_models: ['bb84', 'qsvm-bb84'],
  },
];

window.CLASSIFIER_DATASETS = CLASSIFIER_DATASETS;

// The dataset shown on load (the draw-to-predict MNIST canvas).
window.UI_CONFIG ??= CLASSIFIER_DATASETS[0];

// Backend origin, resolved the same way the rest of the portal resolves it
// (?classifiers= / ?backend= / localStorage / default). navbar:connect will
// overwrite this with the user-chosen URL.
// Deploy-based default: the gateway is the only production backend. A localhost
// default here would bake a dead local option into the deployed page; local dev
// still works via the allowlisted ?backend=/?classifiers= params (which admit
// localhost only when the page itself is served from localhost).
window.API_BASE ??= ServiceConfig.resolveBackend(
  'classifiers',
  SitePass.gatewayBase('classifiers'),
);

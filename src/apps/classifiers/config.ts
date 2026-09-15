/**
 * Portal bootstrap for the classifier embed.
 *
 * The app reads two globals at load time: `API_BASE` (the backend origin) and
 * `UI_CONFIG` (the active dataset's config). This side-effect module supplies
 * them, so the entry imports it BEFORE the app module. The backend URL is
 * resolved via ServiceConfig and refreshed on `navbar:connect` (the app keeps its
 * `base()` prefix live against `window.API_BASE`).
 */

import { ServiceConfig } from '../shared/service-config';
import { SitePass } from '../shared/pass';

export interface DatasetDef {
  name: string;
  display_name: string;
  input_type: 'image' | 'tabular';
  class_labels: string[];
  features?: string[];
  /** Display names for features that aren't just their key in words, e.g. "QBER". */
  feature_labels?: Record<string, string>;
  /** The unit every feature is measured in, shown with its range. */
  unit?: string;
  /** In-browser model assets for the demo tier; the first is the primary
   *  (full-class) model that also defines the input form. */
  local_models: string[];
}

// Datasets the in-browser demo can switch between with no backend. Each carries
// the UI shape the app reads through UI_CONFIG; the trained weights (and, for
// tabular datasets, feature ranges) ship as per-model JSON fetched on demand.
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
    unit: 'cm',
    local_models: ['iris', 'qsvm-iris'],
  },
  {
    name: 'bb84',
    display_name: 'BB84 Eavesdropper Detection',
    input_type: 'tabular',
    class_labels: ['clean', 'eavesdropped'],
    features: ['qber', 'sifted_key_rate'],
    feature_labels: { qber: 'QBER' },
    local_models: ['bb84', 'qsvm-bb84'],
  },
];

window.CLASSIFIER_DATASETS = CLASSIFIER_DATASETS;

// The dataset shown on load (the draw-to-predict MNIST canvas).
window.UI_CONFIG ??= CLASSIFIER_DATASETS[0];

// Backend origin, resolved like the rest of the portal (?classifiers= / ?backend= /
// localStorage / default); navbar:connect overwrites it with the user-chosen URL. The
// default is the gateway, the only production backend: a localhost default would bake a
// dead option into the deployed page, and local dev still works via the allowlisted
// params (which admit localhost only when the page itself is served from localhost).
window.API_BASE ??= ServiceConfig.resolveBackend(
  'classifiers',
  SitePass.gatewayBase('classifiers'),
);

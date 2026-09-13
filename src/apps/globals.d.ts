// The window-boundary contract: the modules import each other, but still PUBLISH these
// globals, typed here for code outside the bundle and the unit tests' browser shims.
import type { SitePassApi } from './shared/pass';
import type { ServiceConfigApi } from './shared/service-config';
import type { SiteContractApi } from './shared/contract-client';
import type { UiKitApi } from './ui-kit/ui-kit';
import type { ClassifierInferApi } from './classifiers/infer';
import type { ConnectionManager } from './classifiers/connection';
import type { DatasetDef } from './classifiers/config';

declare global {
  interface Window {
    SitePass: SitePassApi;
    ServiceConfig: ServiceConfigApi;
    SiteContract: SiteContractApi;
    UIKit: UiKitApi;
    ClassifierInfer: ClassifierInferApi;
    connectionManager: ConnectionManager;
    /** Datasets the in-browser classifier demo can switch between. */
    CLASSIFIER_DATASETS?: DatasetDef[];
    /** The active dataset's UI shape (swapped on client-side dataset switch). */
    UI_CONFIG?: DatasetDef;
    /** Mutable rendezvous: seeded by each app's config, rewritten on navbar:connect. */
    API_BASE?: string;
  }
}

export {};

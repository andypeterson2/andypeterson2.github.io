// What one module entry hands another on a page that loads several, plus the seam
// an e2e spec reaches through. Modules otherwise import each other directly.
import type { SitePassApi } from './shared/pass';
import type { SiteContractApi } from './shared/contract-client';
import type { DatasetDef } from './classifiers/config';

declare global {
  interface Window {
    SitePass: SitePassApi;
    /** The backend client, published so an e2e spec can drive it inside the page. */
    SiteContract: SiteContractApi;
    /** Datasets the in-browser classifier demo can switch between. */
    CLASSIFIER_DATASETS?: DatasetDef[];
    /** The active dataset's UI shape (swapped on client-side dataset switch). */
    UI_CONFIG?: DatasetDef;
    /** Mutable rendezvous: seeded by each app's config, rewritten on navbar:connect. */
    API_BASE?: string;
  }
}

export {};

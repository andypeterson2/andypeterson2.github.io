// The window-boundary contract for the ported app modules. During the classic-
// script era this graph existed only as ESLint `globals` comments; the modules
// now import each other directly, but they still PUBLISH these globals so the
// contract with anything outside the bundle (and with the unit tests' browser
// shims) stays visible and typed in one place.
import type { SitePassApi } from './shared/pass';
import type { ServiceConfigApi } from './shared/service-config';
import type { SiteContractApi } from './shared/contract-client';
import type { UiKitApi } from './ui-kit/ui-kit';

declare global {
  interface Window {
    SitePass: SitePassApi;
    ServiceConfig: ServiceConfigApi;
    SiteContract: SiteContractApi;
    UIKit: UiKitApi;
    /** Mutable rendezvous: seeded by each app's config, rewritten on navbar:connect. */
    API_BASE?: string;
  }
}

export {};

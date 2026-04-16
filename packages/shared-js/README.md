# shared-js

Shared vanilla JavaScript modules used across the portfolio site and its sub-projects.

## Modules

### `service-config.js`
Service configuration for static-hosted frontends. Provides discovery and connection settings so pages know where their backend services are running when hosted on GitHub Pages.

### `site-nav.js`
Site-wide navigation IIFE. Builds the Projects submenu and handles active-state highlighting for the System 6 menubar.

### `theme-bootstrap.js`
Theme bootstrap script (must load first in `<head>`). Reads theme preference from localStorage and applies it before first paint to prevent flash-of-wrong-theme.

## Usage

Include via `<script is:inline>` in Astro layouts or reference from `astro.config.mjs` subpath serving.

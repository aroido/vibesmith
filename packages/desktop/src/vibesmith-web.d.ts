/**
 * Type declarations for @vibesmith/web imports.
 * Desktop uses Vite alias at build time; these declarations satisfy type-check only.
 */
declare module '@vibesmith/web/App' {
  import type { FC } from 'react';
  export const App: FC;
}

declare module '@vibesmith/web/i18n' {
  import type { i18n as I18nInstance } from 'i18next';
  const i18n: I18nInstance;
  export default i18n;
}

declare module '@vibesmith/web/styles/globals.css' {
  const url: string;
  export default url;
}

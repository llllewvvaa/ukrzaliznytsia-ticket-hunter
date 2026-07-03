import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'UZ Ticket Hunter',
    description:
      'Моніторить і бронює квитки Укрзалізниці (УЗ) на booking.uz.gov.ua. Лише для особистого використання.',
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      128: '/icon/128.png',
    },
    permissions: [
      'storage',
      'unlimitedStorage', // debug recorder log can grow large
      'alarms',
      'notifications',
      'tabs',
      'offscreen',
      'sidePanel',
      'webNavigation',
      // rewrites forbidden Origin/Referer on SW requests to app.uz.gov.ua (net-rules.ts)
      'declarativeNetRequestWithHostAccess',
    ],
    host_permissions: [
      'https://app.uz.gov.ua/*',
      'https://booking.uz.gov.ua/*',
      // public schedule site, read-only no auth — lists pre-sale scheduled trains
      'https://www.uz.gov.ua/*',
    ],
    web_accessible_resources: [
      {
        resources: ['sounds/*'],
        matches: ['https://booking.uz.gov.ua/*'],
      },
    ],
  },
  zip: {
    name: 'ukrzaliznytsia-ticket-hunter',
    artifactTemplate: '{{name}}_{{version}}.zip',
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});

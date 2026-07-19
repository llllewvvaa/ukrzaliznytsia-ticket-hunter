import { createRoot } from 'react-dom/client';
import { PaymentCelebrateBanner } from '@/components/PaymentCelebrateBanner';
import { listJobs } from '@/lib/store';

export default defineContentScript({
  matches: ['https://booking.uz.gov.ua/payment*', 'https://booking.uz.gov.ua/*/payment*'],
  runAt: 'document_idle',
  async main() {
    // Check if we should show the banner
    // We show it if there is at least one job in 'reserved' state
    try {
      const jobs = await listJobs();
      const hasReservedJob = jobs.some((j) => j.state === 'reserved');
      
      if (!hasReservedJob) {
        return;
      }

      // To prevent showing it continuously on every SPA re-render/visit within the same session
      // if the user hasn't paid yet, we can record that we showed it for this session.
      // But actually, it's nice to remind them. Let's show it once per page load.
      if (sessionStorage.getItem('uz_hunter_celebrated')) {
        return;
      }
      sessionStorage.setItem('uz_hunter_celebrated', '1');

      const containerId = 'uz-hunter-celebration-root';
      if (document.getElementById(containerId)) return; // Already injected

      const container = document.createElement('div');
      container.id = containerId;
      document.body.appendChild(container);

      const root = createRoot(container);
      root.render(<PaymentCelebrateBanner />);
    } catch (e) {
      console.error('[uz] Failed to render payment celebration:', e);
    }
  },
});

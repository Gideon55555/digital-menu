import { trackEvent } from '@/lib/analytics';

async function test() {
  await trackEvent('menu_view');

  console.log('Analytics test completed.');
}

test();
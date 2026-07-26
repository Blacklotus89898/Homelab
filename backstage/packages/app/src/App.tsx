import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { notificationsPlugin } from '@backstage/plugin-notifications';
import { signalsPlugin } from '@backstage/plugin-signals';
import { navModule } from './modules/nav';

export default createApp({
  features: [catalogPlugin, navModule, notificationsPlugin, signalsPlugin],
});

import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import searchPlugin from '@backstage/plugin-search/alpha';
import scaffolderPlugin from '@backstage/plugin-scaffolder/alpha';
import userSettingsPlugin from '@backstage/plugin-user-settings/alpha';
import orgPlugin from '@backstage/plugin-org/alpha';
import catalogImportPlugin from '@backstage/plugin-catalog-import/alpha';
import catalogGraphPlugin from '@backstage/plugin-catalog-graph/alpha';
import kubernetesPlugin from '@backstage/plugin-kubernetes/alpha';
import techdocsPlugin from '@backstage/plugin-techdocs/alpha';
import apiDocsPlugin from '@backstage/plugin-api-docs/alpha';
import signalsPlugin from '@backstage/plugin-signals/alpha';
import notificationsPlugin from '@backstage/plugin-notifications/alpha';
import { navModule } from './modules/nav';

export default createApp({
  features: [
    catalogPlugin,
    searchPlugin,
    scaffolderPlugin,
    userSettingsPlugin,
    orgPlugin,
    catalogImportPlugin,
    catalogGraphPlugin,
    kubernetesPlugin,
    techdocsPlugin,
    apiDocsPlugin,
    signalsPlugin,
    notificationsPlugin,
    navModule,
  ],
});

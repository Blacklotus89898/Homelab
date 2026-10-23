import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';

// Petal runs on every Component's overview page (Petal ADR 0003).
const petalRunsEntityCard = EntityCardBlueprint.make({
  name: 'petal-runs',
  params: {
    filter: { kind: 'component' },
    loader: async () =>
      import('./PetalRunsCard').then(m => <m.PetalRunsCard />),
  },
});

export const petalModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [petalRunsEntityCard],
});

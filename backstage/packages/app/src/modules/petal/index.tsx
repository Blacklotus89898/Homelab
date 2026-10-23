import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { FormFieldBlueprint } from '@backstage/plugin-scaffolder-react/alpha';

// Petal runs on every Component's overview page (Petal ADR 0003).
const petalRunsEntityCard = EntityCardBlueprint.make({
  name: 'petal-runs',
  params: {
    filter: { kind: 'component' },
    loader: async () =>
      import('./PetalRunsCard').then(m => <m.PetalRunsCard />),
  },
});

// `ui:field: PetalPipelinePicker` for templates/petal-run.
const petalPipelinePickerField = FormFieldBlueprint.make({
  name: 'petal-pipeline-picker',
  params: {
    field: () =>
      import('./PetalPipelinePicker').then(m => m.PetalPipelinePicker),
  },
});

export const petalModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [petalRunsEntityCard],
});

export const petalScaffolderModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [petalPipelinePickerField],
});

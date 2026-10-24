/*
 * `ui:field: PetalPipelinePicker` — the petal-run template's pipeline input.
 * Suggests Petal's own catalog (GET /api/pipelines via the GET-only /petal
 * proxy) but accepts any typed name: since multi-repo runs (Petal ADR 0004) a
 * component's pipelines live in its own repo, which Petal only reads at
 * checkout — so e.g. `validate` for homelab-platform is typed, not listed.
 * Petal fails the run at checkout if the pipeline isn't in that repo.
 */
import { useEffect, useState } from 'react';
import { TextField } from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/frontend-plugin-api';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';

type Pipeline = { name: string; description?: string };

function PetalPipelinePickerComponent(
  props: FieldExtensionComponentProps<string>,
) {
  const { onChange, formData, required, rawErrors, schema, idSchema } = props;
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loadError, setLoadError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const base = await discoveryApi.getBaseUrl('proxy');
      const res = await fetchApi.fetch(`${base}/petal/pipelines`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Pipeline[];
    })().then(
      p => !cancelled && setPipelines(p),
      e => !cancelled && setLoadError(String(e?.message ?? e)),
    );
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetchApi]);

  const describe = (name: string) =>
    pipelines.find(p => p.name === name)?.description;

  return (
    <Autocomplete
      freeSolo
      options={pipelines.map(p => p.name)}
      value={formData ?? ''}
      onChange={(_, v) => onChange((v as string | null) ?? '')}
      onInputChange={(_, v) => onChange(v)}
      renderOption={name => {
        const d = describe(name);
        return d ? `${name} — ${d}` : name;
      }}
      renderInput={params => (
        <TextField
          {...params}
          id={idSchema?.$id}
          label={schema.title ?? 'Pipeline'}
          required={required}
          error={(rawErrors?.length ?? 0) > 0}
          margin="normal"
          helperText={
            loadError
              ? `Couldn't load Petal's pipelines (${loadError}) — type the name`
              : schema.description ??
                "Suggestions are Petal's own pipelines; type another repo's pipeline name"
          }
        />
      )}
    />
  );
}

export const PetalPipelinePicker = createFormField({
  name: 'PetalPipelinePicker',
  component: PetalPipelinePickerComponent,
});

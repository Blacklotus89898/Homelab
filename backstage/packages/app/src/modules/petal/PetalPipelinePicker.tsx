/*
 * `ui:field: PetalPipelinePicker` — the petal-run template's pipeline input,
 * filled from Petal's live catalog (GET /api/pipelines via the GET-only /petal
 * proxy) instead of a hard-coded enum. If Petal can't be reached it falls back
 * to free text; Petal still rejects an unknown pipeline with a 404.
 */
import { useEffect, useState } from 'react';
import { MenuItem, TextField } from '@material-ui/core';
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
  const [pipelines, setPipelines] = useState<Pipeline[] | undefined>();
  const [loadError, setLoadError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const base = await discoveryApi.getBaseUrl('proxy');
      const res = await fetchApi.fetch(`${base}/petal/pipelines`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Pipeline[];
    })().then(
      p => {
        if (cancelled) return;
        setPipelines(p);
        // One pipeline: preselect it, the common case today.
        if (!formData && p.length === 1) onChange(p[0].name);
      },
      e => !cancelled && setLoadError(String(e?.message ?? e)),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryApi, fetchApi]);

  const common = {
    id: idSchema?.$id,
    label: schema.title ?? 'Pipeline',
    required,
    error: (rawErrors?.length ?? 0) > 0,
    fullWidth: true,
    margin: 'normal' as const,
  };

  if (loadError || (pipelines && pipelines.length === 0)) {
    return (
      <TextField
        {...common}
        value={formData ?? ''}
        onChange={e => onChange(e.target.value)}
        helperText={
          loadError
            ? `Couldn't load Petal's pipelines (${loadError}) — type the name`
            : 'Petal has no pipelines in its catalog — type the name'
        }
      />
    );
  }

  return (
    <TextField
      {...common}
      select
      value={formData ?? ''}
      onChange={e => onChange(e.target.value as string)}
      disabled={!pipelines}
      helperText={
        pipelines ? schema.description : "Loading Petal's pipelines…"
      }
    >
      {(pipelines ?? []).map(p => (
        <MenuItem key={p.name} value={p.name}>
          {p.description ? `${p.name} — ${p.description}` : p.name}
        </MenuItem>
      ))}
    </TextField>
  );
}

export const PetalPipelinePicker = createFormField({
  name: 'PetalPipelinePicker',
  component: PetalPipelinePickerComponent,
});

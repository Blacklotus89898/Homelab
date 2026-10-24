/*
 * `ui:field: PetalPipelinePicker` — the petal-run template's pipeline input.
 * Lists the pipelines of the repo behind the component picked in the same
 * form: entity → `petal.io/repo` annotation → GET /api/pipelines?repo=<alias>
 * (Petal ADR 0004; a cached sparse clone of that repo's .petal/pipelines),
 * through the GET-only /petal proxy. Typing a name stays possible (freeSolo)
 * for a pipeline on a branch, or when Petal can't be reached.
 */
import { useEffect, useState } from 'react';
import { TextField } from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';

type Pipeline = { name: string; description?: string };

const REPO_ANNOTATION = 'petal.io/repo';

function PetalPipelinePickerComponent(
  props: FieldExtensionComponentProps<string>,
) {
  const { onChange, formData, required, rawErrors, schema, idSchema } = props;
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const catalogApi = useApi(catalogApiRef);
  // The scaffolder Stepper passes the whole form's data as formContext.formData.
  const entityRef: string | undefined = (props.formContext as any)?.formData
    ?.entity;

  const [repo, setRepo] = useState<string | undefined>();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [status, setStatus] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    setPipelines([]);
    setRepo(undefined);
    if (!entityRef) {
      setStatus('Pick a component first');
      return () => {
        cancelled = true;
      };
    }
    setStatus('Loading pipelines…');
    (async () => {
      const entity = await catalogApi.getEntityByRef(entityRef);
      const alias = entity?.metadata.annotations?.[REPO_ANNOTATION];
      if (!alias) throw new Error(`${entityRef} has no ${REPO_ANNOTATION}`);
      const base = await discoveryApi.getBaseUrl('proxy');
      const res = await fetchApi.fetch(
        `${base}/petal/pipelines?repo=${encodeURIComponent(alias)}`,
      );
      if (!res.ok) throw new Error(`Petal: HTTP ${res.status}`);
      return { alias, list: (await res.json()) as Pipeline[] };
    })().then(
      ({ alias, list }) => {
        if (cancelled) return;
        setRepo(alias);
        setPipelines(list);
        setStatus(undefined);
        if (!formData && list.length === 1) onChange(list[0].name);
      },
      e =>
        !cancelled && setStatus(`${String(e?.message ?? e)} — type the name`),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityRef, catalogApi, discoveryApi, fetchApi]);

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
            status ??
            (repo
              ? `Pipelines in repo "${repo}" (.petal/pipelines on its default branch)`
              : schema.description)
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

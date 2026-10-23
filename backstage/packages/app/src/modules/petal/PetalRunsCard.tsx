/*
 * "Petal runs" entity card (Petal ADR 0003): the last runs Petal recorded for
 * this entity, read through the GET-only `/petal` proxy endpoint. Runs are
 * matched by the provenance convention backstage:<entity-ref>#<user-ref>, so
 * the source filter `backstage:<entity-ref>#` returns exactly this entity's.
 */
import { useEffect, useState } from 'react';
import {
  InfoCard,
  Link,
  Progress,
  ResponseErrorPanel,
  StatusAborted,
  StatusError,
  StatusOK,
  StatusPending,
  StatusRunning,
} from '@backstage/core-components';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/frontend-plugin-api';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { useEntity } from '@backstage/plugin-catalog-react';

const CONSOLE_URL = 'https://petal.lab.home';
const LIMIT = 5;

type PetalRun = {
  id: string;
  pipeline: string;
  status: string;
  trigger_source: string;
  queued_at: string;
  finished_at?: string;
  error?: string;
};

function StatusLabel({ status }: { status: string }) {
  switch (status) {
    case 'succeeded':
      return <StatusOK>succeeded</StatusOK>;
    case 'failed':
      return <StatusError>failed</StatusError>;
    case 'running':
      return <StatusRunning>running</StatusRunning>;
    case 'queued':
      return <StatusPending>queued</StatusPending>;
    default:
      return <StatusAborted>{status}</StatusAborted>;
  }
}

function startedBy(source: string): string {
  const user = source.split('#')[1] ?? '';
  return user.replace(/^user:default\//, '') || 'unknown';
}

export function PetalRunsCard() {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const entityRef = stringifyEntityRef(entity);

  const [runs, setRuns] = useState<PetalRun[] | undefined>();
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const base = await discoveryApi.getBaseUrl('proxy');
      const source = encodeURIComponent(`backstage:${entityRef}#`);
      const res = await fetchApi.fetch(
        `${base}/petal/runs?source=${source}&limit=${LIMIT}`,
      );
      if (!res.ok) {
        throw new Error(`Petal API returned HTTP ${res.status}`);
      }
      return (await res.json()) as PetalRun[];
    })().then(
      r => !cancelled && setRuns(r),
      e => !cancelled && setError(e),
    );
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetchApi, entityRef]);

  const deepLink = {
    title: 'Open Petal console',
    link: CONSOLE_URL,
  };

  if (error) {
    return (
      <InfoCard title="Petal runs">
        <ResponseErrorPanel error={error} />
      </InfoCard>
    );
  }
  if (!runs) {
    return (
      <InfoCard title="Petal runs">
        <Progress />
      </InfoCard>
    );
  }

  return (
    <InfoCard title="Petal runs" deepLink={deepLink}>
      {runs.length === 0 ? (
        <p>
          No Petal runs for this component yet. Start one with the{' '}
          <Link to="/create/templates/default/petal-run">
            Run a Petal pipeline
          </Link>{' '}
          template.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th>Run</th>
              <th>Pipeline</th>
              <th>Status</th>
              <th>By</th>
              <th>Queued</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(run => (
              <tr key={run.id} title={run.error ?? ''}>
                <td>
                  <Link to={`${CONSOLE_URL}/?run=${encodeURIComponent(run.id)}`}>
                    {run.id}
                  </Link>
                </td>
                <td>{run.pipeline}</td>
                <td>
                  <StatusLabel status={run.status} />
                </td>
                <td>{startedBy(run.trigger_source)}</td>
                <td>{new Date(run.queued_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </InfoCard>
  );
}

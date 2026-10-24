/*
 * petal:run — the Backstage → Petal trigger (Petal ADR 0003: Backstage is the
 * portal, Petal is the orchestrator).
 *
 * Queues a run through Petal's v1 API (`POST /api/runs`, bearer token) and
 * returns as soon as the run is queued — progress lives in Petal's console,
 * linked from the template output. Provenance follows the ADR convention
 * `backstage:<entity-ref>#<user-ref>`, so Petal can list one entity's runs with
 * `GET /api/runs?source=backstage:<entity-ref>%23`.
 *
 * Source repo (Petal ADR 0004): the `repo` input, else the entity's
 * `petal.io/repo` annotation (an alias in Petal's allowlist). An entity without
 * either is refused rather than silently running Petal's own repo.
 *
 * Config (app-config / apps/backstage/values.yaml):
 *   petal.baseUrl     in-cluster API, e.g. http://petal.petal.svc.cluster.local
 *   petal.consoleUrl  browser-facing console, e.g. https://petal.lab.home
 *   petal.token       ${PETAL_API_TOKEN} (sealed secret petal-api-token)
 */
import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import {
  createTemplateAction,
  scaffolderActionsExtensionPoint,
} from '@backstage/plugin-scaffolder-node';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import type { BackstageCredentials } from '@backstage/backend-plugin-api';

/** Annotation naming the Petal allowlist alias of an entity's repo. */
export const PETAL_REPO_ANNOTATION = 'petal.io/repo';

/** The slice of the catalog service the action needs (easy to fake in tests). */
export type EntityLookup = {
  getEntityByRef(
    ref: string,
    options: { credentials: BackstageCredentials },
  ): Promise<
    { metadata: { annotations?: Record<string, string> } } | undefined
  >;
};

export type PetalOptions = {
  baseUrl: string;
  consoleUrl: string;
  token: string;
};

type PetalRun = {
  id: string;
  status: string;
  pipeline: string;
  repo?: string;
  ref?: string;
};

export function createPetalRunAction(
  opts: PetalOptions,
  catalog: EntityLookup,
) {
  const baseUrl = opts.baseUrl.replace(/\/+$/, '');
  const consoleUrl = opts.consoleUrl.replace(/\/+$/, '');

  return createTemplateAction({
    id: 'petal:run',
    description:
      'Queue a Petal pipeline run, recorded as triggered from Backstage for an entity.',
    supportsDryRun: true,
    schema: {
      input: {
        pipeline: z => z.string().min(1).describe('Petal pipeline name'),
        entityRef: z =>
          z
            .string()
            .min(1)
            .describe(
              'Catalog entity the run is for, e.g. component:default/petal',
            ),
        args: z =>
          z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Pipeline params, passed through as the run args'),
        repo: z =>
          z
            .string()
            .optional()
            .describe(
              `Petal repo alias; default: the entity's ${PETAL_REPO_ANNOTATION} annotation`,
            ),
        ref: z =>
          z
            .string()
            .optional()
            .describe("Branch, tag or SHA; default: the repo's default_ref"),
      },
      output: {
        runId: z => z.string().describe('Petal run id'),
        runUrl: z => z.string().describe('Run in the Petal console'),
      },
    },
    async handler(ctx) {
      const { pipeline, entityRef, args, ref } = ctx.input;
      const source = `backstage:${entityRef}#${ctx.user?.ref ?? 'unknown'}`;

      let repo = ctx.input.repo;
      if (!repo) {
        const entity = await catalog.getEntityByRef(entityRef, {
          credentials: await ctx.getInitiatorCredentials(),
        });
        repo = entity?.metadata.annotations?.[PETAL_REPO_ANNOTATION];
      }
      if (!repo) {
        throw new Error(
          `${entityRef} has no ${PETAL_REPO_ANNOTATION} annotation — add one naming its repo in Petal's allowlist (Homelab services/petal/repos-configmap.yaml)`,
        );
      }

      if (ctx.isDryRun) {
        ctx.logger.info(
          `dry run: would queue ${pipeline} from ${repo} (${source})`,
        );
        ctx.output('runId', 'dry-run');
        ctx.output('runUrl', consoleUrl);
        return;
      }
      if (!opts.token) {
        throw new Error(
          'petal.token is not configured (PETAL_API_TOKEN) — refusing an unauthenticated trigger',
        );
      }

      const res = await fetch(`${baseUrl}/api/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opts.token}`,
        },
        body: JSON.stringify({
          pipeline,
          repo,
          ...(ref ? { ref } : {}),
          args: args ?? {},
          trigger_kind: 'backstage',
          trigger_source: source,
          // A scaffolder retry of the same task must not queue a second build.
          dedup_key: `backstage-task:${ctx.task.id}`,
        }),
        signal: ctx.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(
          `Petal rejected the run (HTTP ${res.status}): ${detail}`,
        );
      }

      const run = (await res.json()) as PetalRun;
      const runUrl = `${consoleUrl}/?run=${encodeURIComponent(run.id)}`;
      ctx.logger.info(
        `queued Petal run ${run.id} (${run.pipeline} from ${run.repo}@${run.ref}, ${run.status})`,
      );
      ctx.logger.info(`follow it at ${runUrl}`);
      ctx.output('runId', run.id);
      ctx.output('runUrl', runUrl);
    },
  });
}

export default createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'petal',
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
        catalog: catalogServiceRef,
      },
      async init({ scaffolder, config, catalog }) {
        scaffolder.addActions(
          createPetalRunAction(
            {
              baseUrl:
                config.getOptionalString('petal.baseUrl') ??
                'http://petal.petal.svc.cluster.local',
              consoleUrl:
                config.getOptionalString('petal.consoleUrl') ??
                'https://petal.lab.home',
              token: config.getOptionalString('petal.token') ?? '',
            },
            catalog,
          ),
        );
      },
    });
  },
});

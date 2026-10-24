import { createPetalRunAction, EntityLookup } from './petal';

const opts = {
  baseUrl: 'http://petal.test/',
  consoleUrl: 'https://petal.lab.home/',
  token: 's3cret',
};

// Fake catalog: component:default/petal carries the petal.io/repo annotation,
// component:default/bare does not.
const annotations: Record<string, Record<string, string>> = {
  'component:default/petal': { 'petal.io/repo': 'petal' },
  'component:default/homelab-platform': { 'petal.io/repo': 'homelab' },
  'component:default/bare': {},
};
const catalog: EntityLookup = {
  getEntityByRef: async ref =>
    ref in annotations
      ? { metadata: { annotations: annotations[ref] } }
      : undefined,
};

function mockContext(input: Record<string, unknown>, extra: object = {}) {
  const outputs: Record<string, unknown> = {};
  const ctx: any = {
    input,
    task: { id: 'task-123' },
    user: { ref: 'user:default/jo' },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    getInitiatorCredentials: async () => ({
      $$type: '@backstage/BackstageCredentials',
    }),
    output: (k: string, v: unknown) => {
      outputs[k] = v;
    },
    ...extra,
  };
  return { ctx, outputs };
}

function okRun(body: object) {
  return {
    ok: true,
    status: 201,
    json: async () => ({ status: 'queued', ...body }),
  };
}

describe('petal:run', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it('queues a run with ADR 0003 provenance, the annotated repo, and returns the console link', async () => {
    fetchMock.mockResolvedValue(
      okRun({
        id: 'run_abc',
        pipeline: 'docker-image',
        repo: 'petal',
        ref: 'main',
      }),
    );
    const { ctx, outputs } = mockContext({
      pipeline: 'docker-image',
      entityRef: 'component:default/petal',
    });

    await createPetalRunAction(opts, catalog).handler(ctx);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://petal.test/api/runs');
    expect(init.headers.Authorization).toBe('Bearer s3cret');
    expect(JSON.parse(init.body)).toEqual({
      pipeline: 'docker-image',
      repo: 'petal',
      args: {},
      trigger_kind: 'backstage',
      trigger_source: 'backstage:component:default/petal#user:default/jo',
      dedup_key: 'backstage-task:task-123',
    });
    expect(outputs).toEqual({
      runId: 'run_abc',
      runUrl: 'https://petal.lab.home/?run=run_abc',
    });
  });

  it('prefers explicit repo/ref inputs over the annotation (Petal ADR 0004)', async () => {
    fetchMock.mockResolvedValue(okRun({ id: 'run_x', pipeline: 'validate' }));
    const { ctx } = mockContext({
      pipeline: 'validate',
      entityRef: 'component:default/petal',
      repo: 'homelab',
      ref: 'feature/x',
    });

    await createPetalRunAction(opts, catalog).handler(ctx);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.repo).toBe('homelab');
    expect(body.ref).toBe('feature/x');
  });

  it('refuses an entity without a petal.io/repo annotation', async () => {
    const { ctx } = mockContext({
      pipeline: 'p',
      entityRef: 'component:default/bare',
    });

    await expect(
      createPetalRunAction(opts, catalog).handler(ctx),
    ).rejects.toThrow(/no petal\.io\/repo annotation/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces Petal errors', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":"unknown repo \\"evil\\""}',
    });
    const { ctx } = mockContext({
      pipeline: 'p',
      entityRef: 'component:default/bare',
      repo: 'evil',
    });

    await expect(
      createPetalRunAction(opts, catalog).handler(ctx),
    ).rejects.toThrow(/HTTP 400.*unknown repo/);
  });

  it('refuses to run without a token', async () => {
    const { ctx } = mockContext({
      pipeline: 'p',
      entityRef: 'component:default/petal',
    });

    await expect(
      createPetalRunAction({ ...opts, token: '' }, catalog).handler(ctx),
    ).rejects.toThrow(/PETAL_API_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call Petal on a dry run', async () => {
    const { ctx, outputs } = mockContext(
      { pipeline: 'p', entityRef: 'component:default/homelab-platform' },
      { isDryRun: true },
    );

    await createPetalRunAction(opts, catalog).handler(ctx);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(outputs.runId).toBe('dry-run');
  });
});

import { createPetalRunAction } from './petal';

const opts = {
  baseUrl: 'http://petal.test/',
  consoleUrl: 'https://petal.lab.home/',
  token: 's3cret',
};

function mockContext(input: Record<string, unknown>, extra: object = {}) {
  const outputs: Record<string, unknown> = {};
  const ctx: any = {
    input,
    task: { id: 'task-123' },
    user: { ref: 'user:default/jo' },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    output: (k: string, v: unknown) => {
      outputs[k] = v;
    },
    ...extra,
  };
  return { ctx, outputs };
}

describe('petal:run', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it('queues a run with ADR 0003 provenance and returns the console link', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'run_abc', status: 'queued', pipeline: 'docker-image' }),
    });
    const { ctx, outputs } = mockContext({
      pipeline: 'docker-image',
      entityRef: 'component:default/petal',
    });

    await createPetalRunAction(opts).handler(ctx);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://petal.test/api/runs');
    expect(init.headers.Authorization).toBe('Bearer s3cret');
    expect(JSON.parse(init.body)).toEqual({
      pipeline: 'docker-image',
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

  it('surfaces Petal errors', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '{"error":"unknown pipeline \\"nope\\""}',
    });
    const { ctx } = mockContext({ pipeline: 'nope', entityRef: 'component:default/x' });

    await expect(createPetalRunAction(opts).handler(ctx)).rejects.toThrow(
      /HTTP 404.*unknown pipeline/,
    );
  });

  it('refuses to run without a token', async () => {
    const { ctx } = mockContext({ pipeline: 'p', entityRef: 'component:default/x' });

    await expect(
      createPetalRunAction({ ...opts, token: '' }).handler(ctx),
    ).rejects.toThrow(/PETAL_API_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call Petal on a dry run', async () => {
    const { ctx, outputs } = mockContext(
      { pipeline: 'p', entityRef: 'component:default/x' },
      { isDryRun: true },
    );

    await createPetalRunAction(opts).handler(ctx);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(outputs.runId).toBe('dry-run');
  });
});

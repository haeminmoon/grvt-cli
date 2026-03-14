import { getOutputFormat } from '../../src/output/formatter';

describe('getOutputFormat', () => {
  it('returns "json" when output option is "json"', () => {
    expect(getOutputFormat({ output: 'json' })).toBe('json');
  });

  it('returns "table" when output option is "table"', () => {
    expect(getOutputFormat({ output: 'table' })).toBe('table');
  });

  it('returns "table" when output option is undefined', () => {
    expect(getOutputFormat({})).toBe('table');
  });

  it('returns "table" for unknown format', () => {
    expect(getOutputFormat({ output: 'csv' })).toBe('table');
  });
});

describe('output function', () => {
  let stdoutSpy: jest.SpyInstance;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    consoleSpy = jest.spyOn(console, 'table').mockImplementation(() => {});
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  // Dynamic import to avoid issues with mocking
  async function getOutput() {
    const mod = await import('../../src/output/formatter');
    return mod.output;
  }

  it('outputs JSON when format is json', async () => {
    const { output } = await import('../../src/output/formatter');
    output({ key: 'value' }, 'json');
    expect(stdoutSpy).toHaveBeenCalledWith(
      JSON.stringify({ key: 'value' }, null, 2) + '\n'
    );
  });

  it('outputs "No data" for null', async () => {
    const { output } = await import('../../src/output/formatter');
    output(null, 'table');
    expect(stdoutSpy).toHaveBeenCalledWith('No data\n');
  });

  it('outputs "No results" for empty array', async () => {
    const { output } = await import('../../src/output/formatter');
    output([], 'table');
    expect(stdoutSpy).toHaveBeenCalledWith('No results\n');
  });

  it('uses console.table for arrays', async () => {
    const { output } = await import('../../src/output/formatter');
    output([{ a: 1 }], 'table');
    expect(consoleSpy).toHaveBeenCalledWith([{ a: 1 }]);
  });

  it('outputs key-value pairs for objects', async () => {
    const { output } = await import('../../src/output/formatter');
    output({ name: 'test', value: 42 }, 'table');
    expect(stdoutSpy).toHaveBeenCalled();
    const calls = stdoutSpy.mock.calls.map((c: any) => c[0]).join('');
    expect(calls).toContain('name');
    expect(calls).toContain('test');
    expect(calls).toContain('value');
    expect(calls).toContain('42');
  });
});

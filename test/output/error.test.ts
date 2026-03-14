import { ActionableError, requireConfig } from '../../src/output/error';

describe('ActionableError', () => {
  it('creates error with message', () => {
    const err = new ActionableError('test error');
    expect(err.message).toBe('test error');
    expect(err.name).toBe('ActionableError');
    expect(err.suggestedCommand).toBeUndefined();
  });

  it('creates error with suggested command', () => {
    const err = new ActionableError('need auth', 'grvt-cli auth login');
    expect(err.message).toBe('need auth');
    expect(err.suggestedCommand).toBe('grvt-cli auth login');
  });

  it('is an instance of Error', () => {
    const err = new ActionableError('test');
    expect(err instanceof Error).toBe(true);
    expect(err instanceof ActionableError).toBe(true);
  });
});

describe('requireConfig', () => {
  it('does not throw when value is defined', () => {
    expect(() => requireConfig('some-value', 'API key', '--api-key <key>')).not.toThrow();
  });

  it('throws ActionableError when value is undefined', () => {
    expect(() => requireConfig(undefined, 'API key', '--api-key <key>')).toThrow(ActionableError);
  });

  it('includes config name in error message', () => {
    try {
      requireConfig(undefined, 'API secret', '--api-secret <secret>');
      fail('Expected error');
    } catch (err) {
      expect(err).toBeInstanceOf(ActionableError);
      expect((err as ActionableError).message).toContain('API secret');
    }
  });

  it('includes set command in suggested command', () => {
    try {
      requireConfig(undefined, 'Sub-account ID', '--sub-account-id <id>');
      fail('Expected error');
    } catch (err) {
      expect((err as ActionableError).suggestedCommand).toContain('--sub-account-id');
    }
  });
});

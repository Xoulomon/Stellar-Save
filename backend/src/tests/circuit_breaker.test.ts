import { CircuitBreaker, CircuitState, CircuitBreakerOpenError } from '../lib/circuit_breaker';

describe('CircuitBreaker Unit Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows normal calls when CLOSED', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const breaker = new CircuitBreaker(fn, { volumeThreshold: 3, errorThresholdPercentage: 50 });

    const result = await breaker.fire();
    expect(result).toBe('success');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('handles function timeouts', async () => {
    const slowFn = jest.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 10000)));
    const breaker = new CircuitBreaker(slowFn, { timeout: 1000 });

    const promise = breaker.fire();
    jest.advanceTimersByTime(1500);

    await expect(promise).rejects.toThrow('timed out');
  });

  it('trips to OPEN state when error threshold is exceeded', async () => {
    const failingFn = jest.fn().mockRejectedValue(new Error('Upstream 500'));
    const breaker = new CircuitBreaker(failingFn, {
      volumeThreshold: 3,
      errorThresholdPercentage: 50,
      resetTimeout: 5000,
    });

    // 3 failures to reach volume threshold and 100% failure rate
    for (let i = 0; i < 3; i++) {
      await expect(breaker.fire()).rejects.toThrow('Upstream 500');
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Subsequent call fails fast with CircuitBreakerOpenError
    await expect(breaker.fire()).rejects.toThrow(CircuitBreakerOpenError);
  });

  it('transitions to HALF_OPEN after resetTimeout and resets to CLOSED on success', async () => {
    let shouldFail = true;
    const fn = jest.fn().mockImplementation(async () => {
      if (shouldFail) throw new Error('Service down');
      return 'recovered';
    });

    const breaker = new CircuitBreaker(fn, {
      volumeThreshold: 3,
      errorThresholdPercentage: 50,
      resetTimeout: 5000,
    });

    // Trip the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.fire()).rejects.toThrow('Service down');
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Advance time beyond resetTimeout
    jest.advanceTimersByTime(6000);
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    // Recovery request succeeds
    shouldFail = false;
    const res = await breaker.fire();
    expect(res).toBe('recovered');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('executes fallback function when provided', async () => {
    const failingFn = jest.fn().mockRejectedValue(new Error('500 Server Error'));
    const fallbackFn = jest.fn().mockResolvedValue('fallback_response');

    const breaker = new CircuitBreaker(failingFn, {
      fallback: fallbackFn,
    });

    const result = await breaker.fire();
    expect(result).toBe('fallback_response');
    expect(fallbackFn).toHaveBeenCalled();
  });
});

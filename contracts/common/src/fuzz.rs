//! Shared fuzzing harness for Stellar-Save contracts.
//!
//! Provides deterministic pseudo-random input generation and execution
//! over a defined iteration budget without requiring external crates.

/// Deterministic 64-bit pseudo-random number generator (XorShift64*).
/// Works in `#![no_std]` environments without requiring heap allocation.
#[derive(Clone, Debug)]
pub struct FuzzRng {
    state: u64,
}

impl FuzzRng {
    /// Creates a new generator from a seed.
    /// Non-zero state is guaranteed.
    pub fn new(seed: u64) -> Self {
        let state = if seed == 0 { 0x8a5cd789635d2dff } else { seed };
        Self { state }
    }

    /// Generates the next pseudo-random u64.
    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.state = x;
        x.wrapping_mul(0x2545F4914F6CDD1D)
    }

    /// Generates the next pseudo-random u32.
    pub fn next_u32(&mut self) -> u32 {
        (self.next_u64() >> 32) as u32
    }

    /// Generates the next pseudo-random i128.
    pub fn next_i128(&mut self) -> i128 {
        let high = self.next_u64() as u128;
        let low = self.next_u64() as u128;
        ((high << 64) | low) as i128
    }

    /// Generates the next pseudo-random boolean.
    pub fn next_bool(&mut self) -> bool {
        (self.next_u64() & 1) == 1
    }

    /// Generates a pseudo-random i128 within inclusive range `[min, max]`.
    pub fn next_in_range_i128(&mut self, min: i128, max: i128) -> i128 {
        if min >= max {
            return min;
        }
        let range = (max - min) as u128;
        let val = (self.next_u64() as u128) % (range + 1);
        min + val as i128
    }

    /// Generates a pseudo-random u32 within inclusive range `[min, max]`.
    pub fn next_in_range_u32(&mut self, min: u32, max: u32) -> u32 {
        if min >= max {
            return min;
        }
        let range = max - min;
        min + (self.next_u32() % (range + 1))
    }

    /// Generates arbitrary boundary values for i128 inputs (0, negative, max, normal).
    pub fn boundary_i128(&mut self, scale: i128) -> i128 {
        match self.next_u32() % 6 {
            0 => 0,
            1 => -1,
            2 => 1,
            3 => i128::MAX,
            4 => i128::MIN,
            _ => self.next_in_range_i128(1, scale),
        }
    }
}

/// Fuzz test runner that executes a target closure for a defined iteration budget.
#[derive(Clone, Debug)]
pub struct FuzzRunner {
    pub seed: u64,
    pub iterations: usize,
}

impl FuzzRunner {
    /// Default fixed iteration budget for fuzz targets (1,000 iterations).
    pub const DEFAULT_BUDGET: usize = 1_000;

    /// Creates a runner with specified seed and iteration count.
    pub fn new(seed: u64, iterations: usize) -> Self {
        Self { seed, iterations }
    }

    /// Creates a runner with default 1,000 iteration budget.
    pub fn default_budget(seed: u64) -> Self {
        Self::new(seed, Self::DEFAULT_BUDGET)
    }

    /// Executes the target closure for `iterations` passes, providing the PRNG and iteration index.
    pub fn run<F>(&self, mut target: F)
    where
        F: FnMut(&mut FuzzRng, usize),
    {
        let mut rng = FuzzRng::new(self.seed);
        for iter in 0..self.iterations {
            target(&mut rng, iter);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fuzz_rng_determinism() {
        let mut rng1 = FuzzRng::new(42);
        let mut rng2 = FuzzRng::new(42);
        for _ in 0..100 {
            assert_eq!(rng1.next_u64(), rng2.next_u64());
        }
    }

    #[test]
    fn test_fuzz_runner_budget() {
        let runner = FuzzRunner::new(123, 500);
        let mut count = 0;
        runner.run(|_, _| {
            count += 1;
        });
        assert_eq!(count, 500);
    }
}

# Contributing to Stellar-Save

Thank you for your interest in contributing to Stellar-Save! This document provides guidelines for contributing to the project.

## Code of Conduct

Be respectful, inclusive, and professional. Harassment, discrimination, or abusive behavior will not be tolerated. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for details.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Stellar-Save.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes
6. Commit and push
7. Open a Pull Request

## Code Style Guidelines

### Rust
- Follow standard Rust formatting: `cargo fmt`
- Run clippy and fix warnings: `cargo clippy -- -D warnings`
- Use descriptive variable names
- Add comments for complex logic
- Keep functions focused and concise

### Smart Contracts
- Document all public functions with doc comments (`///`)
- Include parameter descriptions and return values
- Add `#[cfg(test)]` for test modules
- Use meaningful test names that describe what they test

### General
- Use 4 spaces for indentation (Rust default)
- Keep lines under 100 characters when reasonable
- Remove trailing whitespace

## Testing Requirements

All contributions must include appropriate tests:

- **New features**: Add unit tests covering main functionality and edge cases
- **Bug fixes**: Add a test that reproduces the bug and verifies the fix
- **Refactoring**: Ensure existing tests still pass

Run tests before submitting:
```bash
cargo test
./scripts/test.sh
```

All tests must pass before a PR can be merged.

## Commit Message Conventions

Use clear, descriptive commit messages:

```
<type>: <short summary>

<optional detailed description>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `chore`: Maintenance tasks

**Examples:**
```
feat: add token support for custom assets

fix: prevent duplicate contributions in same cycle

docs: update deployment instructions for mainnet

test: add edge case tests for payout rotation
```

## Pull Request Process

1. **Update documentation** if you're changing functionality
2. **Add tests** for new features or bug fixes
3. **Run the full test suite** and ensure it passes
4. **Update README.md** if adding new features or changing APIs
5. **Keep PRs focused** - one feature or fix per PR
6. **Write a clear PR description**:
   - What does this PR do?
   - Why is this change needed?
   - How has it been tested?
   - Related issues (if any)

### PR Review Process

- Maintainers will review your PR within 3-5 business days
- Address review feedback by pushing new commits
- Once approved, a maintainer will merge your PR
- PRs may be closed if inactive for 30+ days

## Wave-Ready Issues

Looking for funded work? Check out [Wave-Ready Issues](docs/wave-ready-issues.md) for tasks that earn Drips Wave points:
- `trivial` (100 points) - Documentation, simple tests
- `medium` (150 points) - Helper functions, validation logic
- `high` (200 points) - Core features, security enhancements

## Development Setup

```bash
# Install dependencies
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install --locked stellar-cli

# Build the project
./scripts/build.sh

# Run tests
./scripts/test.sh

# Deploy to testnet
stellar keys generate deployer --network testnet
./scripts/deploy_testnet.sh
```

## Questions?

- Open a [GitHub Discussion](https://github.com/Xoulomon/Stellar-Save/discussions)
- Check existing [Issues](https://github.com/Xoulomon/Stellar-Save/issues)
- Contact: [@Xoulomon](https://t.me/Xoulomon)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

# Contributing to blip0

Thank you for your interest in contributing to blip0! This guide covers commit conventions, versioning, and the release process.

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `bun install`
3. Run in dev mode: `bun run dev`

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) to automate versioning and changelog generation.

### Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Allowed Types

| Type       | Description                                      | Version Bump |
|------------|--------------------------------------------------|--------------|
| `feat`     | A new feature                                    | Minor        |
| `fix`      | A bug fix                                        | Patch        |
| `docs`     | Documentation only changes                       | None         |
| `style`    | Code style changes (formatting, semicolons)      | None         |
| `refactor` | Code change that neither fixes nor adds feature  | None         |
| `perf`     | Performance improvement                          | Patch        |
| `test`     | Adding or updating tests                         | None         |
| `chore`    | Maintenance tasks                                | None         |
| `ci`       | CI/CD configuration changes                      | None         |
| `build`    | Build system or dependency changes               | None         |
| `revert`   | Revert a previous commit                         | Varies       |

### Breaking Changes

For breaking changes, add `!` after the type or include `BREAKING CHANGE:` in the footer:

```bash
feat!: remove deprecated API endpoints

BREAKING CHANGE: The v1 API endpoints have been removed.
```

### Examples

```bash
# Feature (triggers minor version bump)
git commit -m "feat: add support for ethereum mainnet"

# Bug fix (triggers patch version bump)
git commit -m "fix: resolve timeout issue in whale-alert"

# Documentation (no version bump)
git commit -m "docs: update installation instructions"

# Breaking change (triggers major version bump)
git commit -m "feat!: change CLI argument format"
```

## Pull Request Process

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes following the coding standards

3. Ensure all tests pass:

   ```bash
   bun test
   ```

4. Commit your changes using conventional commit format

5. Push to your fork and create a Pull Request

6. Wait for review and address any feedback

## Release Workflow

We use [Release Please](https://github.com/googleapis/release-please) to automate releases.

### How It Works

1. When PRs with conventional commits are merged to `main`, Release Please creates/updates a Release PR
2. The Release PR accumulates changes and updates:
   - Version in `package.json`
   - `CHANGELOG.md` with all changes
3. When the Release PR is merged:
   - A GitHub Release is created with release notes
   - The package is automatically published to npm

### Versioning Strategy (SemVer)

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes that require user action
- **MINOR** (0.X.0): New features, backward compatible
- **PATCH** (0.0.X): Bug fixes, backward compatible

### Pre-1.0 Behavior

While at version 0.x.x:

- `feat` commits bump the minor version (0.1.0 -> 0.2.0)
- `fix` commits bump the patch version (0.1.0 -> 0.1.1)
- Breaking changes bump the minor version (not major)

## Code Style

- Use TypeScript for all source files
- Follow existing patterns in the codebase
- Keep functions small and focused

## Questions?

If you have questions, please open an issue or reach out to the maintainers.

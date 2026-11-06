# Contributing

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING_CN.md)

Please describe the problem, expected behavior, and verification in your pull request. Keep changes focused and update documentation and regression tests when behavior changes.

## Reporting problems

Include the source commit, package versions, operating system, reproduction steps, expected result, and actual result. Use synthetic examples. Never attach real memory exports, user databases, credentials, signing keys, or unredacted conversation logs to a public issue.

## Versions

See [VERSIONING.md](VERSIONING.md) for the relationship between source metadata and Debian package versions.

## Development checks

GitHub Actions checks are not currently provided. Run the local checks below. Internal GitLab pipelines build and publish distribution packages; they are not GitHub PR verification.

No dedicated private vulnerability reporting channel is currently published. Do not disclose exploit details or sensitive data in public issues or PRs. Contact the project maintainers to arrange a suitable reporting method before sharing details.

Use the host SDK and React versions declared in package.json. Follow README.md to configure the development adapter, then run:

```bash
npm ci
npm test
npm run typecheck
npm run build:dev
npm run keygen  # once, for a local development signing key
npm run build:plugin
```

Never commit `.bibit-keys/`, generated bundles, or production signing keys. A locally signed development bundle is not an officially trusted distribution package.

Business operations must use `service:memory`; file export uses the host `file:transfer` capability. Keep the frontend independent of private host code and backend credentials. Update contracts, page behavior, development integration, and tests together when changing an operation or DTO.

UI tests use a controlled host mock. Running the development page against a real adapter is a separate integration check; do not change a device running a soak test to perform it.

# Version correspondence

[English](VERSIONING.md) | [简体中文](VERSIONING_CN.md)

The public source currently includes the frontend functionality corresponding to Debian package `bibit-memory-plugin` 0.1.9. This is a source baseline, not a GitHub release or a Debian package published here.

Both package.json and bibit.feature.json currently use 0.1.6. These agree with each other but differ from the Debian packaging version. The locally built artifact therefore uses `memory-0.1.6.bibit-plugin.tgz`; do not treat this name as the installed Debian version.

Include the source commit, Debian package version, host version, and plugin manifest version when reporting an issue. The public repository maintains its own history and distribution layout; internal Debian packaging and offline CI cache are not included in this public snapshot.

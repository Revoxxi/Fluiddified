# Contributing to Fluiddified

Fluiddified is a fork of [Fluidd](https://github.com/fluidd-core/fluidd) — an independent web client for Moonraker and Klipper. It is built with Vue.js and TypeScript (same stack as upstream).

- Source should always pass the linting rules defined, with no warnings or type errors.
- A clean develop is preferred. This means squashing, and rebasing your feature branches prior to merge.
- PRs should be off a branch other than develop or master.
- Commit messages should follow the [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) standard, and should have a Signed-off-by line, for example;

  ```sh
  feat: My feature.

  Some description.

  Signed-off-by: Your Name <your email address>
  ```

- By signing off on commits, you acknowledge that you agree to the [developer certificate of origin](/developer-certificate-of-origin).
  This must contain your real name and a current email address.

After cloning the repo and running `npm install`, we recommend running `npm run bootstrap` to install a couple of git hooks that will pre-validate all new commits.

Upstream Fluidd contribution policy and workflow are described in the [Fluidd repository](https://github.com/fluidd-core/fluidd); this fork follows the same technical standards (lint, types, conventional commits, sign-off) for changes merged here.

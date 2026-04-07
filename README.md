# Fluiddified

Fluiddified is a Klipper web interface for managing your 3D printer, derived from the Fluidd project (GPL-3.0).

**Repository:** [github.com/revoxxi/fluiddified](https://github.com/revoxxi/fluiddified)

## What's Different from Fluidd?

Fluiddified extends Fluidd with:

- **Modular Plugin Framework** — drop-in dashboard widgets with auto-discovery
- **Role-Based Access Control** — owner / user / guest roles with granular permissions
- **Achievement System** — achievements with progression tracking
- **Built-in Proxy Server** — single-port internet exposure with server-side auth enforcement
- **Rebranded UI** — distinct identity while preserving upstream lineage

## Features

- Responsive UI, supports desktop, tablets and mobile
- Customizable layouts — move any panel where YOU want
- Built-in color themes
- Role-based access control for safe internet exposure
- Achievement system for print milestones

## Support & Documentation

Documentation source lives in this repository under [`docs/docs/`](docs/docs/). Build locally with `npm run serve:docs`, or browse files on GitHub.

Release downloads: [GitHub Releases](https://github.com/revoxxi/fluiddified/releases).

## How to Use

See [Getting Started](docs/docs/getting-started.md) and [Configuration](docs/docs/configuration.md) in `docs/docs/`, and the [Klipper](https://www.klipper3d.org/) / [Moonraker](https://moonraker.readthedocs.io/) upstream manuals for printer firmware and API setup.

## Credits

Fluiddified is built on the excellent work of the Fluidd project by Craig Bassett and the Fluidd contributors. Full credit to the upstream team.

Additional thanks to:

- the [Voron Community](http://vorondesign.com/)
- Kevin O'Connor for [Klipper](https://github.com/Klipper3d/klipper)
- Eric Callahan for [Moonraker](https://github.com/Arksine/moonraker)
- Dominik Willner for [KIAUH](https://github.com/dw-0/kiauh)

## License

GPL-3.0 — same as upstream Fluidd.

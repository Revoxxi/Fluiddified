---
title: Getting Started
icon: lucide/rocket
---

# Getting Started

Fluidd requires three components to run:

- **[Klipper](https://www.klipper3d.org/)** — the printer firmware
- **[Moonraker](https://moonraker.readthedocs.io/)** — the API server that
  bridges Klipper with web interfaces
- **Fluiddified** — the web UI you're reading about

The easiest way to install all three is with KIAUH.

## KIAUH

[KIAUH](https://github.com/dw-0/kiauh) (Klipper Installation And Update
Helper) is the recommended way to install Klipper and Moonraker. For the web UI,
install Fluiddified from [this project's releases](https://github.com/revoxxi/fluiddified/releases)
or build from source (below).

KIAUH also supports installing [Kalico](https://docs.kalico.gg) as an
alternative firmware for advanced users.

[View on GitHub](https://github.com/dw-0/kiauh){.md-button}

## Docker

Fluiddified can be containerized from the `Dockerfile` in this repository, or you
can serve the `fluidd.zip` asset from [GitHub Releases](https://github.com/revoxxi/fluiddified/releases)
behind any static HTTP server (same layout as a manual install).

## Manual Installation

Every Fluiddified release includes a pre-built `fluidd.zip` on the
[GitHub Releases](https://github.com/revoxxi/fluiddified/releases) page.
Extract it and serve with any HTTP server (e.g. NGINX).

To build from source (requires Node.js v22.12+ or v24.x and Git):

1. `git clone https://github.com/revoxxi/fluiddified.git`
2. `cd fluiddified`
3. `npm ci`
4. `npm run build`

The output is written to `dist/`.

!!! note "Raspberry Pi"
    Building on a Raspberry Pi is not supported due to hardware limitations.
    Build on a PC and copy `dist/` to your Pi using `scp` or similar.

## Self-hosted Fluiddified

Host the built UI on your LAN (Raspberry Pi, NAS, or PC) and point your browser at it.
Add that origin to `cors_domains` in `moonraker.conf` (for example `http://fluiddified.local`)
so Moonraker allows your browser to call the API. See the
[Moonraker example configuration](/configuration#example-configuration).

## FluiddPI

!!! warning "FluiddPI is not recommended"
    FluiddPI is not under active maintenance and we've had reports from users
    finding issues while using it. We recommend using [KIAUH](#kiauh) to
    install Fluidd instead.

FluiddPI is a Raspberry Pi OS Lite image pre-configured with Klipper,
Moonraker, and Fluidd.

[View on GitHub](https://github.com/fluidd-core/FluiddPi){.md-button}

### Download

Download the latest release of
[FluiddPI](https://github.com/fluidd-core/FluiddPi/releases/latest).

### Flash

1. Use a quality SD card from a reputable brand (Sandisk, Samsung, Kingston).
2. The flashing process will **wipe your SD card**.

For Windows: [Balena Etcher](https://www.balena.io/etcher/).
For Linux/macOS: [Raspberry Pi Imager](https://www.raspberrypi.org/software/).

### Configure

1. Edit `fluiddpi-wpa-supplicant.txt` on the root of the flashed card to
   configure Wi-Fi. Do not use WordPad (Windows) or TextEdit (macOS) — use
   Notepad++, VSCode, or similar.
   - If you have connectivity issues, try a wired ethernet connection.
2. Boot the Pi from the card.
3. SSH into the Pi at `fluiddpi.local` (or its IP address if Bonjour is
   unavailable).
   - Default credentials: `pi` / `raspberry`
4. Run `sudo raspi-config` to change your password, timezone, locale, and
   optionally the hostname.
5. Access Fluidd at `http://fluiddpi.local` (or `http://yourhostname.local`
   if you changed the hostname).

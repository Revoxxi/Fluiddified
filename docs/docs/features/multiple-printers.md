---
title: Multiple Printers
---

# Multiple Printers

Fluiddified can connect to and switch between multiple printers from a single
browser tab. Each printer runs its own Moonraker instance and Fluiddified stores
connection details locally.

## Adding a printer

1. Open the right-side drawer from the top bar.
2. Click **Add Printer** at the bottom of the printer list.
3. Enter the Moonraker URL (e.g., `http://printer.local` or
   `http://192.168.1.50:7125`).
4. Fluiddified verifies the connection automatically. If successful, the save
   button becomes available.

If the connection fails with a CORS error, you need to add Fluiddified's origin to
Moonraker's `cors_domains`. See the
[Moonraker configuration](/configuration#cors-domains) docs.

## Switching printers

Click any printer in the drawer list to switch. Fluiddified fully reinitializes —
loading the new printer's settings, state, and authentication from its
Moonraker instance.

!!! info "Bookmarkable URLs"
    Each printer selection can be bookmarked. Fluiddified appends a `?printer=`
    query parameter to the URL — an automatically generated identifier derived
    from the printer's API URL. Opening that URL in the same browser will
    select the matching saved printer automatically.

## Printer names

Each printer's display name is set in Settings — General — Printer Name. The
name is stored in that printer's Moonraker database, so it persists across
browsers.

## Removing a printer

In the printer list, click the delete icon next to any inactive printer to
remove it. The active printer cannot be removed.

## Network requirements

- If Fluiddified is served from the same host as Moonraker (e.g., a KIAUH
  install), no extra configuration is needed — `trusted_clients` covers
  local connections.
- If Fluiddified is served from a different host (e.g., a dedicated web host or a
  separate server), Moonraker must list Fluiddified's origin in `cors_domains`.
  See the [configuration example](/configuration#example-configuration).

Each printer connection uses both HTTP (for initialization) and WebSocket (for
live data). The WebSocket URL is derived automatically from the HTTP URL.

## Authentication

Auth tokens are stored independently per printer. Switching printers also
switches authentication state, so each printer can have its own user accounts
and login requirements.

![Printer selection dropdown listing multiple configured printers](/assets/images/printer-selection.png)

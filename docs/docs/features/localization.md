---
title: Localization
---

# Localization

Fluiddified is available in multiple languages. By default, Fluiddified detects your
browser's language preference and loads the closest matching translation
automatically. If no match is found, English is used.

## Changing language

Go to Settings — General — Language and select a language from the dropdown.
Choose **Browser default** to use automatic detection based on your browser's
language setting.

![Language selection dropdown in Fluiddified settings](/assets/images/localization.png)

## Contributing translations

Locale data inherits from **upstream [Fluidd](https://github.com/fluidd-core/fluidd)**. New strings for **Fluiddified-only** features may be added in English in this repository per maintainer guidance; coordinated translation work for the shared strings is still centered on
[Weblate](https://hosted.weblate.org/engage/fluidd/) (Fluidd’s project). Do not edit non-English locale files directly unless maintainers say otherwise — prefer Weblate for upstream-backed locales. The
[Weblate project page](https://hosted.weblate.org/engage/fluidd/) shows the
current completion percentage for each language, and new languages can be added
there without needing a code change for the core UI.

See the [developer localization](/development#localization) docs for technical
details on how translations work.

# Localization work in progress

Only English is enabled. The profile selector, per-account preference, local
catalog loader and right-to-left layout foundations are implemented, but the
requested multilingual release is not complete.

`source.en.json` contains messages already migrated to the localization API;
it is **not** an inventory of every possible screen or assistant response.
`source-contexts.json` records source locations and static placeholder examples.
Do not put user names, wallet addresses, balances or other runtime data into a
translation catalog or send them to a translation provider.

Translation catalogs use English source messages as keys. Placeholders such as
`{amount}` must occur the same number of times in the source and translation.
`{strongStart}` / `{strongEnd}` and `{timerStart}` / `{timerEnd}` mark safe,
movable formatting boundaries; translators must keep each pair balanced.
The runtime escapes catalog text and substitutes dynamic values locally.

Before enabling a language, finish migrating and reviewing all screens,
including uncommon wallet states, administrative records and the support
assistant. Review the actual financial meaning in context, not just placeholder
or number equality. Add the reviewed catalog and review metadata, then set
`localization/coverage.json` to complete only after verifying that coverage.
`check:i18n-release` checks catalog completeness, placeholders, numeric values
and review digests for every enabled language. It does not prove translation
quality or discover untranslated application text.

Useful commands:

```sh
npm run extract:i18n
npm run check:i18n
npm run test:i18n
npm run check:i18n-release
npm run test:ui
```

Unreviewed machine-generated candidate files used during development are in
the ignored `artifacts/locales-candidate` directory and are not release
catalogs. The current Georgian candidate contains a limited manual review of
financial messages; the rest remains unreviewed.

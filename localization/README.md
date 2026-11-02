# Localization work in progress

English is the default. The other selectable languages are **automatic,
incomplete previews** and have not passed professional linguistic review. Missing
entries fall back to English. The requested fully translated and reviewed
multilingual release is not complete; the profile page communicates this limit.

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

Before marking a language as reviewed, finish migrating and reviewing all screens,
including uncommon wallet states, administrative records and the support
assistant. Review the actual financial meaning in context, not just placeholder
or number equality. Add the reviewed catalog and review metadata, then set
`localization/coverage.json` to complete only after verifying that coverage.
`check:i18n-release` checks placeholders and numeric values for enabled preview
catalog entries and reports coverage. It also requires complete coverage and
review digests for any language marked reviewed. It does not prove translation
quality or discover untranslated application text.

Useful commands:

```sh
npm run extract:i18n
npm run check:i18n
npm run test:i18n
npm run check:i18n-release
npm run test:ui
```

The preview catalogs are in `public/locales`. Some longer financial messages
have intentionally been omitted from the previews so they fall back to English;
this filter is not a substitute for professional review. The Georgian catalog
also contains a limited manual review of financial messages. Development
candidates are in the ignored `artifacts/locales-candidate` directory.

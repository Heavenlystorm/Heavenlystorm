# Fonts

The SVG cards embed subsets of two typefaces, both under the
[SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/):

- `plex-regular.woff2`, `plex-semibold.woff2`: IBM Plex Sans, Copyright © IBM Corp.
  ([github.com/IBM/plex](https://github.com/IBM/plex))
- `martian-mono.woff2`: Martian Mono, Copyright © Evil Martians
  ([github.com/evilmartians/mono](https://github.com/evilmartians/mono))

The subsets keep printable ASCII and a few punctuation marks. They are made with
`tools/subset_fonts.py`; `metrics.json` holds their advance widths for text layout.

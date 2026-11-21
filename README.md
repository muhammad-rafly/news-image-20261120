# The World Today — Friday 20 November 2026

[![make.fun · news-image-20261120](https://make.fun/badge/news-image-20261120.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![rank](https://make.fun/badge/news-image-20261120/muhammad-rafly/news-image-20261120/rank.svg)](https://make.fun/bounty/news-image-20261120/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![reward](https://make.fun/badge/news-image-20261120/muhammad-rafly/news-image-20261120/reward.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)

Entry v2 for make.fun bounty `news-image-20261120` — "Sum up 20 November's
world news in one image".

`main.ts` (Node 22, stdlib only) draws a 1024×1024 newspaper front page
entirely in code — own PNG encoder, own 5×7 bitmap font, fixed-seed layout —
and writes it to `/output/entry.png`. Deterministic: two runs produce
identical bytes.

Lead story: GTA VI takes an official $3.79 billion on day one
(32.5M copies sold pre-release, biggest entertainment launch ever).
Also inside: Wall Street's Black Friday (S&P −3.7%, Nasdaq −5.28%,
Nvidia −14% on an SEC probe), Russian missiles land in Poland, the
Prabowo–Xi summit judged a failure, plus an IN BRIEF strip (Trump's
AI data-center tax threat, UK drone pledge, Pete Rose pardon,
Taiwan–Meta, Indonesia–Google, COP31).

Run it:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

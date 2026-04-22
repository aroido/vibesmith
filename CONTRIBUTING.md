# Contributing

Thanks for looking at VibeSmith.

This repository is the public source and release mirror for shipped snapshots.
It is kept buildable and inspectable, but day-to-day maintainer planning and
internal review work happens outside this mirror.

## What To Expect

- Bug reports and narrowly scoped release regressions are the best fit for this
  repository.
- Public source snapshots may lag behind private day-to-day development.
- Pull requests may not be reviewed or merged on the same cadence as release
  builds.
- Do not add maintainer-only workflow assets, private planning docs, local agent
  state, or design and marketing source material here.

## Build And Verify

```bash
make setup
./scripts/ai-verify --mode full
```

## Pull Requests

If you open a PR, keep it focused and include:

- the problem being fixed
- the user-visible behavior change
- the verification command you ran

## License

By contributing, you agree that your contribution is provided under the Apache
License 2.0 used by this repository.

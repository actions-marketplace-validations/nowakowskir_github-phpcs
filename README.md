### Installation steps

Make sure `phpcs.xml` file exists in the root directory of your repository. This file should define a configuration and rules to be used by PHP Code Sniffer.

Create following file under `.git/workflows/phpcs.yml` directory of your repository.

```
name: "PHPCodeSniffer checks"

on:
  pull_request:
    paths:
      - "**.php"
      - "phpcs.xml"
      - ".github/workflows/phpcs.yml"

jobs:
  phpcs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 0
          
      - name: Install PHPCodeSniffer
        run: |
          curl -OL https://squizlabs.github.io/PHP_CodeSniffer/phpcs.phar
          php phpcs.phar --version

      - uses: nowakowskir/github-phpcs@v6
```
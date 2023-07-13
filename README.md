### About

This is a simple GitHub Workflow action script that runs PHP Code Sniffer on Pull Request.

It assumes you have your PHP Code Sniffer configuration file in the project root directory. This configuration file is then automatically injected to the isolated GitHub Workflow job together with your Pull Request context.

Your Pull Request will not be ready to merge until this job completes successfully.

If PHP Code Sniffer fails, the job will fail, failing your Pull Request as well.

It automatically adds remarks in the corresponding lines under the `Files changed` tab of your Pull Request.

Any subsequent commit to the Pull Request triggers the job again.

PHP Code Sniffer is being executed in two different ways:
* for the new files created in the PR - it performs checks the whole file,
* for the existing files, modified in the PR - it performs checks only on the modified context, allowing you to gradually improve the code quality of your files. In other words, it will only check the lines that have been changed in the given Pull Request, without bothering about the rest of the file, even if it doesn't comply with the standards.

Pull Request becomes valid, and being able to merge if there are no standard violation in the given context.

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

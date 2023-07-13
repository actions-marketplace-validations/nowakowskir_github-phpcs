const { lint } = require('php-codesniffer');
const core = require('@actions/core');
const github = require('@actions/github');
const { spawn } = require('child_process');
const { createInterface }  = require('readline');
const path = require('path');
const picomatch = require('picomatch');
const { existsSync } = require('fs');

async function run() {
    try {
        const matches = picomatch('**.php');

        console.log(JSON.stringify(github.context.payload, undefined, 2));

        const diffProcess = spawn('git',
            [
                '--no-pager',
                'diff-tree',
                '--no-commit-id',
                '--name-status',
                '--diff-filter=d',
                '-r',
                `${github.context.payload.pull_request.base.sha}..`
            ],
            {
                windowsHide: true,
                timeout: 10000,
            }
        );

        const lines = createInterface({
            input: diffProcess.stdout,
        });

        const affectedFiles = {
            added: [],
            modified: [],
        };

        const matchersPath = path.join(__dirname, '.', '.github');
        console.log(
            `##[add-matcher]${path.join(matchersPath, 'phpcs-matcher.json')}`
        );

        for await (const line of lines) {
            const parsed = /^(?<status>[ACMR])[\s\t]+(?<file>\S+)$/.exec(line);
            if (parsed.groups) {
                const { status, file } = parsed.groups;
                if (matches(file) && existsSync(file)) {
                    switch (status) {
                        case 'A':
                        case 'C':
                        case 'R':
                            affectedFiles.added.push(file);
                            break;
                        case 'M':
                            affectedFiles.modified.push(file);
                    }
                }
            }
        }

        if (affectedFiles.added.length === 0 && affectedFiles.modified.length === 0) {
            core.warning('Empty list of files, nothing to process!');

            return;
        }

        if (affectedFiles.added.length > 0) {
            const lintResults = await lint(
                affectedFiles.added,
                'php phpcs.phar',
                {
                    standard: 'phpcs.xml'
                }
            );

            for (const [file, results] of Object.entries(lintResults.files)) {
                if (results.messages.length > 0) {
                    console.log(`${path.relative(process.cwd(), file)}`);
                    for (const message of results.messages) {
                        console.log(
                            '  %d:%d  %s  %s  %s',
                            message.line,
                            message.column,
                            message.type.toLowerCase(),
                            message.message,
                            message.source
                        );

                        core.setFailed(message.message);
                    }
                }
            }
        }

        const prCommitsProcess = spawn('git',
            ['log', `${github.context.payload.pull_request.base.sha}..${github.context.payload.pull_request.head.sha}`, '--pretty=format:"%h"'],
            { encoding: 'utf8', windowsHide: true, timeout: 5000 }
        );

        const prLines = createInterface({
            input: prCommitsProcess.stdout,
        });

        const prCommits = [];

        for await (const prLine of prLines) {
            prCommits.push(prLine.replace(/"/g, ''));
        }

        console.log('Commits within this PR:');
        console.log(prCommits);

        const fileBlameCommitsByLine = {};

        console.log('Files modified:');
        console.log(affectedFiles.modified);

        if (affectedFiles.modified.length > 0) {
            const lintResults = await lint(
                affectedFiles.modified,
                'php phpcs.phar',
                {
                    standard: 'phpcs.xml'
                }
            );

            for (const file of affectedFiles.modified) {
                const blameProcess = spawn(
                    'git',
                    ['blame', '-s', '--abbrev=6', file],
                    { encoding: 'utf8', windowsHide: true, timeout: 5000 }
                );

                const blameLines = createInterface({
                    input: blameProcess.stdout,
                });

                let lineNumber = 1;
                for await (const blameLine of blameLines) {
                    if (! fileBlameCommitsByLine[file]) {
                        fileBlameCommitsByLine[file] = {};
                    }
                    const commitHash = blameLine.substring(0, 7);

                    if (commitHash && commitHash.length === 7) {
                        fileBlameCommitsByLine[file][lineNumber.toString()] = blameLine.substring(0, 7);
                    }

                    lineNumber++;
                }
            }

            for (const [file, results] of Object.entries(lintResults.files)) {
                if (results.messages.length > 0) {
                    const relativePath = `${path.relative(process.cwd(), file)}`;

                    console.log(file);

                    for (const message of results.messages) {
                        if (fileBlameCommitsByLine[relativePath]
                            && fileBlameCommitsByLine[relativePath][message.line]
                            && prCommits.includes(fileBlameCommitsByLine[relativePath][message.line])) {

                            console.log(
                                '  %d:%d  %s  %s  %s',
                                message.line,
                                message.column,
                                message.type.toLowerCase(),
                                message.message,
                                message.source
                            );

                            core.setFailed(message.message);
                        }
                    }
                }
            }

            console.log(fileBlameCommitsByLine);
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
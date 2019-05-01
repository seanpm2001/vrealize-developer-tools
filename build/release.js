/*
 * Copyright 2018-2019 VMware, Inc.
 * SPDX-License-Identifier: MIT
 */

const gulp = require("gulp");
const log = require("fancy-log");
const publishRelease = require("gulp-github-release");
const { ReleaseNotes } = require("pull-release-notes");

const REPO_OWNER = "vmware";
const REPO_NAME = "vrealize-developer-tools";

function createRelease(releaseVersion) {
    log.info(`Creating GitHub release v${releaseVersion}`)
    const stream = gulp.src("./*.vsix").pipe(publishRelease({
        token: process.env.GITHUB_SECRET,
        owner: REPO_OWNER,
        repo: REPO_NAME,
        name: releaseVersion,
        notes: "Pending changelog",
        tag: `v${releaseVersion}`,
        draft: true,
        prerelease: true,
        reuseDraftOnly: true,
        skipIfPublished: true
    }));

    return toPromise(stream);
}

function getReleaseNotes(from, to) {
    const releaseNotes = new ReleaseNotes({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        fromTag: "v" + from,
        toTag: "v" + to,
        formatter: ReleaseNotes.defaultFormatter,
    })

    return releaseNotes.pull(process.env.GITHUB_SECRET);
}

function updateRelease(releaseVersion, notes) {
    log.info(`Updating GitHub release v${releaseVersion} with release notes`)
    const stream = publishRelease({
        token: process.env.GITHUB_SECRET,
        owner: REPO_OWNER,
        repo: REPO_NAME,
        name: releaseVersion,
        notes: notes,
        tag: `v${releaseVersion}`,
        draft: false,
        prerelease: true,
        reuseDraftOnly: true,
        skipIfPublished: true
    });

    return toPromise(stream);
}

function toPromise(stream) {
    return new Promise(function (resolve, reject) {
        stream.on("finish", resolve).on("error", reject);
    });
}

module.exports = function () {
    if (!process.env.GITHUB_SECRET) {
        throw new Error("Missing GitHub secret")
    }

    if (!process.env.PREV_RELEASE_VERSION) {
        throw new Error("Missing previous release version")
    }

    const currentVersion = process.env.PREV_RELEASE_VERSION;
    const releaseVersion = require("../package.json").version;

    return Promise.resolve()
        .then(() => createRelease(releaseVersion))
        .then(() => getReleaseNotes(currentVersion, releaseVersion))
        .then((notes) => updateRelease(releaseVersion, notes))
        .catch((error) => log.error(error));
};
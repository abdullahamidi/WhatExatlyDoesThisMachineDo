'use strict';
// Edition naming for the Electron shell and the packager. Node built-ins only (no electron import), so
// src/platform tests can load it. A demo gets its own save folder, window title and app-user-model id so
// its saves never mix with the full game.

const BASE_USER_DIR = 'WhatExactlyDoesThisMachineDo';
const BASE_TITLE = 'What Exactly Does This Machine Do?';
const BASE_MODEL_ID = 'com.abdullahamidi.wedtmd';

// package.json wedtmdEdition is written by the packager; a missing or unknown value is the full game.
function editionOf(pkg) {
  return pkg !== null && typeof pkg === 'object' && pkg.wedtmdEdition === 'demo' ? 'demo' : 'full';
}

function userDirName(edition, packaged) {
  return BASE_USER_DIR + (edition === 'demo' ? ' Demo' : '') + (packaged ? '' : '-dev');
}

function windowTitle(edition) {
  return BASE_TITLE + (edition === 'demo' ? ' Demo' : '');
}

function appUserModelId(edition) {
  return BASE_MODEL_ID + (edition === 'demo' ? '.demo' : '');
}

module.exports = { editionOf, userDirName, windowTitle, appUserModelId };

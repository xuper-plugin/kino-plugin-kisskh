/**
 * The values KissKH's web app feeds its kkey signer, read from the player chunk (502.33bac7b53e9897b8.js) of the bundle
 * main.c582432abad915cc.js on 2026-11-12. They rotate: when the endpoints start answering 403, re-pull the bundle, compare
 * these with the player component's constructor (`this.viGuid`, `this.subGuid`, `this.appVer`, `this.platformVer`,
 * `this.appName`) and re-vendor kkey.js.
 */
export const KKEY = {
  appName: "kisskh",
  appVer: "2.8.10",
  platformVer: 4830201,
  viGuid: "62f176f3bb1b5b8e70e39932ad34a0c7",
  subGuid: "VgV52sWhwvBSf8BsM3BRY9weWiiCbtGp",
};

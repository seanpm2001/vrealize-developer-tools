/*!
 * Copyright 2018-2020 VMware, Inc.
 * SPDX-License-Identifier: MIT
 */
import * as path from 'path';

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { AbxActionDefinition, ActionRuntime, ActionType, getActionManifest, PackageDefinition } from '@vmware-pscoe/polyglotpkg';

import { getActionRuntime } from './utils';
import { VraNgRestClient } from '../rest';

export class AbxAction {

    /**
     * Create an AbxAction from local package definition
     */
    static async fromPackage(workspace: string): Promise<AbxAction> {
        const pkgObj = await getActionManifest(workspace) as PackageDefinition;
        if (!AbxAction.isAbxActionPackage(pkgObj)) {
            throw new Error('Not an ABX Action Package');
        }
        return new AbxAction(pkgObj as AbxActionDefinition);
    }

    /**
     * Create an AbxAction from remote action representation
     * @param client
     * @param projectId
     * @param action
     */
    static async fromRemoteState(client: VraNgRestClient, projectId: string, action: AbxAction): Promise<AbxAction | null> {

        const serverAction = await client.getAbxActionByName(action.name, projectId);
        if (!serverAction) {
            return null;
        }

        // create remote action representation
        const remoteAction = new AbxAction({
            name: serverAction.name,
            description: serverAction.description || '',
            version: '0.0.1', // this is just a placeholder to match action schema, and it is not used anywhere
            platform: {
                action: serverAction.name,
                entrypoint: serverAction.entrypoint,
                runtime: serverAction.runtime,
            },
            abx: {
                inputs: serverAction.inputs,
            }
        });
        remoteAction.remoteActionId = serverAction.id;
        remoteAction.remoteProjectId = serverAction.projectId;

        return remoteAction;

    }

    /**
     * Check whether a package object is an AbxAction definition
     * @param pkgObj
     */
    static isAbxActionPackage(pkgObj: PackageDefinition) {
        return pkgObj &&
            pkgObj.hasOwnProperty('platform') &&
            pkgObj.platform.hasOwnProperty('action') &&
            pkgObj.platform.hasOwnProperty('entrypoint') &&
            pkgObj.platform.hasOwnProperty('runtime') &&
            pkgObj.hasOwnProperty('abx');
    }

    private _remoteActionId: string | null = null;
    private _remoteProjectId: string | null = null;
    private readonly _name: string;
    private readonly _description: string;
    private readonly _entrypoint: string;
    private readonly _inputs: { [key: string]: string };
    private readonly _runtime: ActionRuntime;

    constructor(pkg: AbxActionDefinition) {
        this._name = pkg.platform.action;
        this._description = pkg.description;
        this._entrypoint = pkg.platform.entrypoint;
        this._inputs = pkg.abx.inputs || {};
        this._runtime = getActionRuntime(pkg.platform.runtime || ActionRuntime.ABX_NODEJS, ActionType.ABX);
    }

    async getRunDefinition() {
        // parse the entrypoint and look for debug definitions
        const entrypointModule = path.basename(this._entrypoint.split('.')[0]);
        const runDefs = await vscode.workspace.findFiles(`**/${entrypointModule}.debug.yaml`, '**/node_modules/**', 1);
        let yamlObj;
        if (runDefs.length > 0) {
            const runDefsYAML = (await vscode.workspace.fs.readFile(runDefs[0])).toString();
            yamlObj = yaml.safeLoad(runDefsYAML) as { [key: string]: any };
        }
        return yamlObj || {};
    }

    get name() {
        return this._name;
    }

    get description() {
        return this._description;
    }

    get entrypoint() {
        return this._entrypoint;
    }

    get inputs() {
        return this._inputs;
    }

    get runtime() {
        return this._runtime;
    }

    get remoteActionId() {
        return this._remoteActionId;
    }

    set remoteActionId(id) {
        this._remoteActionId = id;
    }

    get remoteProjectId() {
        return this._remoteProjectId;
    }

    set remoteProjectId(id) {
        this._remoteProjectId = id;
    }

}

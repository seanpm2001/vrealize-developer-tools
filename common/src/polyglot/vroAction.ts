/*!
 * Copyright 2018-2020 VMware, Inc.
 * SPDX-License-Identifier: MIT
 */
import * as path from 'path';

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { ActionRuntime, ActionType, getActionManifest, PackageDefinition, VroActionDefinition } from '@vmware-pscoe/polyglotpkg';

import { getActionRuntime } from './utils';
import { VroRestClient } from '../rest';

export class VroAction {

    /**
     * Create a VroAction from local package definition
     */
    static async fromPackage(workspace: string): Promise<VroAction> {
        const pkgObj = await getActionManifest(workspace) as PackageDefinition;
        if (!VroAction.isVroActionPackage(pkgObj)) {
            throw new Error('Not a vRO Action Package');
        }
        return new VroAction(pkgObj as VroActionDefinition);
    }

    /**
     * Create a VroAction from remote action representation
     * @param client
     * @param action
     */
    static async fromRemoteState(client: VroRestClient, action: VroAction): Promise<VroAction | null> {

        // find module
        const modules = await client.getActionSubcategories();
        const module = modules.link.find((m: any) => {
            return (m.href as string).endsWith(`${action.module}/`);
        });
        if (!module) {
            return null;
        }
        const remoteModuleId = module.attributes.find((a: any) => a.name === 'id').value;

        // find action within the module
        const moduleContents = await client.getCategoryById(remoteModuleId);
        const correctLink = moduleContents.relations.link
        .filter((l: any) => l.hasOwnProperty('attributes'))
        .find((l: any) => l.attributes.find((a: any) => a.name === 'name' && a.value === action.name));
        if (!correctLink) {
            return null;
        }
        const remoteActionId = correctLink.attributes.find((a: any) => a.name === 'id').value;

        // fetch action information
        const remoteActionContents = await client.getActionById(remoteActionId);
        const remoteActionVersion = remoteActionContents.version;
        const remoteActionEntryPoint = remoteActionContents.entryPoint;
        const remoteActionOutputType = remoteActionContents['output-type'];
        // get inputs
        const remoteActionInputs: {[key: string]: string} = {};
        remoteActionContents['input-parameters'].forEach((param: { name: string, type: string }) => {
            remoteActionInputs[param.name] = param.type;
        });

        const remoteCatalogContents = await client.getActionContentsById(remoteActionId);
        const remoteActionTags = remoteCatalogContents.attributes.find((a: any) => a.name === 'globalTags').value?.split(' ');
        const reamoteActionDescription = remoteCatalogContents.attributes.find((a: any) => a.name === 'description').value?.split(' ');

        // construct remote action
        const remoteAction = new VroAction({
            name: action.name,
            description: reamoteActionDescription || '',
            version: remoteActionVersion,
            platform: {
                action: action.name,
                entrypoint: remoteActionEntryPoint,
                runtime: 'nodejs', // this is just a placeholder to match action schema, and it is not used anywhere
                tags: remoteActionTags.slice(0, remoteActionTags.length -1),
            },
            vro: {
                module: action.module,
                inputs: remoteActionInputs,
                outputType: remoteActionOutputType
            }
        });
        remoteAction.remoteActionId = remoteActionId;
        remoteAction.remoteModuleId = remoteModuleId;

        return remoteAction;

    }

    /**
     * Check whether a package object is a VroAction definition
     * @param pkgObj
     */
    static isVroActionPackage(pkgObj: PackageDefinition) {
        return pkgObj &&
            pkgObj.hasOwnProperty('platform') &&
            pkgObj.platform.hasOwnProperty('action') &&
            pkgObj.platform.hasOwnProperty('entrypoint') &&
            pkgObj.platform.hasOwnProperty('runtime') &&
            pkgObj.hasOwnProperty('vro') &&
            pkgObj.vro.hasOwnProperty('module');
    }

    private _remoteModuleId: string | null = null;
    private _remoteActionId: string | null = null;
    private readonly _name: string;
    private readonly _description: string;
    private readonly _module: string;
    private readonly _entrypoint: string;
    private readonly _version: string;
    private readonly _tags: string[];
    private readonly _inputs: { [key: string]: string };
    private readonly _outputType: string;
    private readonly _runtime: ActionRuntime;

    constructor(pkg: VroActionDefinition) {
        this._name = pkg.platform.action;
        this._description = pkg.description;
        this._module = pkg.vro.module;
        this._entrypoint = pkg.platform.entrypoint;
        this._version = pkg.version.replace('-SNAPSHOT', '') || '0.0.1';
        this._tags = pkg.platform.tags || [];
        this._inputs = pkg.vro.inputs || {};
        this._outputType = pkg.vro.outputType || 'string';
        this._runtime = getActionRuntime(pkg.platform.runtime || ActionRuntime.VRO_NODEJS_12, ActionType.VRO);
    }

    async getRunDefinition() {
        // parse the entrypoint and look for debug definitions
        const entrypointModule = path.basename(this._entrypoint.split('.')[0]);
        const runDefs = await vscode.workspace.findFiles(`**/${entrypointModule}.debug.yaml`, '**/node_modules/**', 1);
        let yamlObj;
        if (runDefs.length > 0) {
            const runDefsYAML = (await vscode.workspace.fs.readFile(runDefs[0])).toString();
            yamlObj = yaml.safeLoad(runDefsYAML);
        }
        return yamlObj || {};
    }

    get name() {
        return this._name;
    }

    get description() {
        return this._description;
    }

    get module() {
        return this._module;
    }

    get entrypoint() {
        return this._entrypoint;
    }

    get tags() {
        return this._tags;
    }

    get version() {
        return this._version;
    }

    get inputs() {
        return this._inputs;
    }

    get outputType() {
        return this._outputType;
    }

    get runtime() {
        return this._runtime;
    }

    get remoteModuleId() {
        return this._remoteModuleId;
    }

    set remoteModuleId(id) {
        this._remoteModuleId = id;
    }

    get remoteActionId() {
        return this._remoteActionId;
    }

    set remoteActionId(id) {
        this._remoteActionId = id;
    }

}

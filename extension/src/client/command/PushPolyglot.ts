/*!
 * Copyright 2018-2020 VMware, Inc.
 * SPDX-License-Identifier: MIT
 */

import { AutoWire, Logger, VraNgRestClient, VroRestClient } from "vrealize-common"
import * as vscode from "vscode"
import { ActionType, determineActionType } from "@vmware-pscoe/polyglotpkg"

import { Commands } from "../constants"
import { ConfigurationManager, EnvironmentManager } from "../system"
import { BaseVraCommand } from "./BaseVraCommand"
import { VraIdentityStore } from "../storage"
import { AbxActionIntegration } from "./polyglot/AbxActionIntegration"
import { VroActionIntegration } from "./polyglot/VroActionIntegration"

@AutoWire
export class PushPolyglot extends BaseVraCommand {

    private readonly logger = Logger.get("PushPolyglot");
    private vroRestClient: VroRestClient;
    private vraRestClient: VraNgRestClient;

    get commandId(): string {
        return Commands.PushPolyglot
    }

    constructor(env: EnvironmentManager, config: ConfigurationManager, identity: VraIdentityStore) {
        super(env, config, identity);
        this.vroRestClient = new VroRestClient(config, env);
    }

    async execute(context: vscode.ExtensionContext): Promise<void> {
        this.logger.info("Executing command PushPolyglot")

        if (this.env.workspaceFolders.length == 0) {
            this.logger.error("PushPolyglot:execute() No opened workspace folders")
            return Promise.reject("There are no workspace folders opened in this window")
        }

        const workspaceFolder = await this.askForWorkspace("Select the workspace of the Polyglot/ABX package");
        this.logger.info(`Workspace folder: ${workspaceFolder.uri.fsPath}`);

        const localBundle = await this.getLocalBundle();

        switch (await determineActionType(workspaceFolder.uri.fsPath)) {
            case ActionType.ABX:
                if (!this.vraRestClient) {
                    this.vraRestClient = await this.getRestClient();
                }
                const projectId = ''; // TODO: get project id
                const abxIntegration = await AbxActionIntegration.build(projectId, workspaceFolder.uri.fsPath, this.vraRestClient, localBundle);
                await abxIntegration.push();
                break;
            case ActionType.VRO:
                const vroIntegration = await VroActionIntegration.build(workspaceFolder.uri.fsPath, this.vroRestClient, localBundle);
                await vroIntegration.push();
                break;
            default:
                throw new Error('Unrecognized action type');
        }

    }

    /**
     * Return the binary content of a compiled local bundle
     */
    async getLocalBundle(): Promise<Uint8Array | undefined> {
        const bundle = await vscode.workspace.findFiles(this.config.polyglotBundle, '**/node_modules/**', 1);
        if (bundle.length === 0) {
            return;
        }
        const content = await vscode.workspace.fs.readFile(bundle[0]);
        return content;
    }
}

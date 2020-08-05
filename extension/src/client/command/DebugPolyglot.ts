/*!
 * Copyright 2018-2020 VMware, Inc.
 * SPDX-License-Identifier: MIT
 */

import { AutoWire, Logger, VroRestClient } from "vrealize-common"
import * as vscode from "vscode"
import { ActionType, determineActionType } from "@vmware-pscoe/polyglotpkg"

import { Commands } from "../constants"
import { ConfigurationManager, EnvironmentManager } from "../system"
import { BaseVraCommand } from "./BaseVraCommand"
import { VraIdentityStore } from "../storage"
import { VroActionIntegration } from "./polyglot/VroActionIntegration"

@AutoWire
export class DebugPolyglot extends BaseVraCommand {

    private readonly logger = Logger.get("DebugPolyglot")
    private vroRestClient: VroRestClient;

    get commandId(): string {
        return Commands.DebugPolyglot
    }

    constructor(env: EnvironmentManager, config: ConfigurationManager, identity: VraIdentityStore) {
        super(env, config, identity);
        this.vroRestClient = new VroRestClient(config, env);
    }

    async execute(context: vscode.ExtensionContext): Promise<void> {
        this.logger.info("Executing command DebugPolyglot")

        if (this.env.workspaceFolders.length == 0) {
            this.logger.error("DebugPolyglot:execute() No opened workspace folders")
            return Promise.reject("There are no workspace folders opened in this window")
        }

        const workspaceFolder = await this.askForWorkspace("Select the workspace of the Polyglot/ABX package");
        this.logger.info(`Workspace folder: ${workspaceFolder.uri.fsPath}`);

        switch (await determineActionType(workspaceFolder.uri.fsPath)) {
            case ActionType.ABX:
                throw new Error('ABX actions are not supported');

            case ActionType.VRO:
                const vroIntegration = await VroActionIntegration.build(workspaceFolder.uri.fsPath, this.vroRestClient);
                await vroIntegration.debug();
                break;
            default:
                throw new Error('Unrecognized action type');
        }

    }
}

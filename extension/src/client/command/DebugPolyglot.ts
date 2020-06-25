/*!
 * Copyright 2018-2020 VMware, Inc.
 * SPDX-License-Identifier: MIT
 */

import { AutoWire, Logger } from "vrealize-common"
import * as vscode from "vscode"

import { Commands } from "../constants"
import { ConfigurationManager, EnvironmentManager } from "../system"
import { BaseVraCommand } from "./BaseVraCommand"
import { VraIdentityStore } from "../storage"

@AutoWire
export class DebugPolyglot extends BaseVraCommand {
    private readonly logger = Logger.get("DebugPolyglot")

    get commandId(): string {
        return Commands.DebugPolyglot
    }

    constructor(env: EnvironmentManager, config: ConfigurationManager, identity: VraIdentityStore) {
        super(env, config, identity)
    }

    async execute(context: vscode.ExtensionContext): Promise<void> {
        this.logger.info("Executing command DebugPolyglot")

        if (this.env.workspaceFolders.length == 0) {
            this.logger.error("DebugPolyglot:execute() No opened workspace folders")
            return Promise.reject("There are no workspace folders opened in this window")
        }

        const workspaceFolder = await this.askForWorkspace("Select the workspace of the Polyglot/ABX package");
        this.logger.info(`Workspace folder: ${workspaceFolder.uri.fsPath}`);

    }
}

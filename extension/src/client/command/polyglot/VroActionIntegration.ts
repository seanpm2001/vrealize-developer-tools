/*!
 * Copyright 2018-2020 VMware, Inc.
 * SPDX-License-Identifier: MIT
 */
import * as vscode from 'vscode';
import { VroAction, VroRestClient } from 'vrealize-common';

export class VroActionIntegration {

    private constructor(private readonly vroAction: VroAction,
        private readonly serverVroAction: VroAction | null,
        private readonly bundle: Uint8Array,
        private readonly restClient: VroRestClient) { }

    static async build(workspaceDir: string,
        restClient: VroRestClient,
        bundle: Uint8Array): Promise<VroActionIntegration> {
        const vroAction = await VroAction.fromPackage(workspaceDir);
        const serverVroAction = await VroAction.fromRemoteState(restClient, vroAction);
        return new VroActionIntegration(vroAction, serverVroAction, bundle, restClient);
    }

    async push() {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Pushing action ${this.vroAction.module}/${this.vroAction.name} to server`,
                cancellable: false
            },
            async (progress, token) => {
                let remoteActionId;
                if (this.serverVroAction) {
                    progress.report({ message: 'updating action', increment: 1 });
                    remoteActionId = await this.updateAction();
                } else {
                    progress.report({ message: 'creating action', increment: 1 });
                    remoteActionId = await this.createAction();
                }
                progress.report({ message: 'uploading bundle', increment: 50 });
                await this.updateBundle(remoteActionId);
            }
        );
    }

    /**
     * Create a new remote action
     */
    private async createAction() {

        const result = await this.restClient.createPolyglotAction({
            module: this.vroAction.module,
            name: this.vroAction.name,
            description: this.vroAction.description,
            runtime: this.vroAction.runtime,
            version: this.vroAction.version,
            entryPoint: this.vroAction.entrypoint,
            'output-type': this.vroAction.outputType,
            'input-parameters': Object.entries(this.vroAction.inputs).map(([name, type]) => ({ name, type, description: '' }))
        });

        // TODO: perform tag sync
        return result.id;
    }

    /**
     * Update existing remote action
     */
    private async updateAction() {

        if (!this.serverVroAction) {
            throw new Error(`Server ABX action not found`);
        }

        this.restClient.updatePolyglotAction(this.serverVroAction.remoteActionId as string, {
            module: this.serverVroAction.module, // module is required by the API
            name: this.serverVroAction.name, // name is reqired by the API
            runtime: this.vroAction.runtime,
            version: this.vroAction.version,
            entryPoint: this.vroAction.entrypoint,
            'output-type': this.vroAction.outputType,
            'input-parameters': Object.entries(this.vroAction.inputs).map(([name, type]) => ({ name, type, description: '' }))
        });

        // TODO: perform tag sync
        return this.serverVroAction.remoteActionId;
    }

    /**
     * Update the bundle of a remote action
     * @param actionId
     */
    private async updateBundle(actionId: string) {
        await this.restClient.updatePolyglotActionBundle(actionId, this.bundle);
    }

}



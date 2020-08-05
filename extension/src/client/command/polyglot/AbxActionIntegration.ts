/*!
 * Copyright 2018-2020 VMware, Inc.
 * SPDX-License-Identifier: MIT
 */
import * as vscode from 'vscode';
import { AbxAction, VraNgRestClient } from 'vrealize-common';

export class AbxActionIntegration {

    private constructor(private readonly abxAction: AbxAction,
        private readonly serverAbxAction: AbxAction | null,
        private readonly bundle: Uint8Array,
        private readonly restClient: VraNgRestClient) { }

    static async build(workspaceDir: string, restClient: VraNgRestClient, bundle: Uint8Array): Promise<AbxActionIntegration> {
        const abxAction = await AbxAction.fromPackage(workspaceDir);
        const serverAbxAction = await AbxAction.fromRemoteState(restClient, '', abxAction); // TODO: add project id taken from configuration
        return new AbxActionIntegration(abxAction, serverAbxAction, bundle, restClient);
    }

    async push() {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Pushing action ${this.abxAction.name} to server`,
                cancellable: false
            },
            async (progress, token) => {
                if (this.serverAbxAction) {
                    progress.report({ message: 'updating action' });
                    await this.updateAction();
                } else {
                    progress.report({ message: 'creating action' });
                    await this.createAction();
                }
            }
        );
    }

    /**
     * Create a new remote action
     */
    private async createAction() {

        const compressedContent = (this.bundle as Buffer).toString('base64');

        await this.restClient.createAbxAction({
            runtime: this.abxAction.runtime,
            actionType: 'SCRIPT',
            projectId: '', // TODO: add project id taken from configuration
            compressedContent,
            name: this.abxAction.name,
            description: this.abxAction.description,
            inputs: this.abxAction.inputs,
            entrypoint: this.abxAction.entrypoint
        });
    }

    /**
     * Update existing remote action
     */
    private async updateAction() {

        const compressedContent = (this.bundle as Buffer).toString('base64');

        if (!this.serverAbxAction) {
            throw new Error(`Server ABX action not found`);
        }

        await this.restClient.updateAbxAction(this.serverAbxAction.remoteActionId as string, {
            runtime: this.abxAction.runtime,
            actionType: 'SCRIPT',
            name: this.serverAbxAction.name, // name is required otherwise it is treated as "null"
            description: this.serverAbxAction.description,
            projectId: this.serverAbxAction.remoteProjectId as string,
            compressedContent,
            inputs: this.abxAction.inputs,
            entrypoint: this.abxAction.entrypoint,
        });
    }

}

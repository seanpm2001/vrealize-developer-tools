/*!
 * Copyright 2018-2020 VMware, Inc.
 * SPDX-License-Identifier: MIT
 */
import * as vscode from 'vscode';
import { AbxAction, AbxExecutionStates, Logger, poll, VraNgRestClient } from 'vrealize-common';

export class AbxActionIntegration {

    private readonly logger = Logger.get("AbxActionIntegration");

    private constructor(
        private readonly projectId: string,
        private readonly abxAction: AbxAction,
        private readonly serverAbxAction: AbxAction | null,
        private readonly restClient: VraNgRestClient,
        private readonly bundle?: Uint8Array) { }

    static async build(
        projectId: string,
        workspaceDir: string,
        restClient: VraNgRestClient,
        bundle?: Uint8Array
    ): Promise<AbxActionIntegration> {
        const abxAction = await AbxAction.fromPackage(workspaceDir);
        const serverAbxAction = await AbxAction.fromRemoteState(restClient, projectId, abxAction);
        return new AbxActionIntegration(projectId, abxAction, serverAbxAction, restClient, bundle);
    }

    /**
     * Push ABX action to remote server
     */
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
     * Remotely run ABX action
     * @param outputChannel
     */
    async run(outputChannel: vscode.OutputChannel) {

        // short circuit run
        if (!this.serverAbxAction) {
            throw new Error(`Server ABX action not found`);
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Running ${this.serverAbxAction.name}`,
                cancellable: false
            },
            async () => {

                const remoteAction = this.serverAbxAction as AbxAction;

                const inputs = await remoteAction.getRunDefinition();

                outputChannel.clear();
                outputChannel.show();

                const result = await this.restClient.runAbxAction(remoteAction.remoteActionId as string, {
                    metadata: { actionTrigger: 'test' }, // the action trigger should always be test
                    inputs,
                    projectId: this.projectId
                });

                const executionId = result.id;

                outputChannel.appendLine(`Running action ${remoteAction.name} (${executionId})`);
                outputChannel.appendLine(`Action inputs: ${JSON.stringify(inputs, null, 2)}`);
                const output = await this.monitorExecutionRun(executionId, outputChannel);
                outputChannel.appendLine(output.logs);
                outputChannel.appendLine(`Run status: ${output.runState} (${executionId})`);

            }
        );

    }

    /**
     * Create a new remote action
     */
    private async createAction() {
        if (!this.bundle) {
            throw new Error(`Local bundle not found`);
        }
        const compressedContent = (this.bundle as Buffer).toString('base64');

        await this.restClient.createAbxAction({
            runtime: this.abxAction.runtime,
            actionType: 'SCRIPT',
            projectId: this.projectId,
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
        if (!this.bundle) {
            throw new Error(`Local bundle not found`);
        }
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

    /**
     * Wait for the execution to complete
     * @param auth
     * @param outputChannel
     */
    private async monitorExecutionRun(executionId: string, outputChannel: vscode.OutputChannel): Promise<any> {

        const finalStates = [
            AbxExecutionStates.COMPLETED,
            AbxExecutionStates.FAILED,
            AbxExecutionStates.CANCELLED,
            AbxExecutionStates.DEPLOYMENT_FAILED,
        ];

        let result = null;
        let lastState: string = AbxExecutionStates.UNKNOWN;
        await poll(async () => {
            this.logger.debug(`Checking status of run ${executionId}`);
            const currentState = await this.restClient.getAbxActionRun(executionId);
            if (currentState.runState !== lastState) {
                lastState = currentState.runState;
                const time = new Date().toLocaleString();
                outputChannel.appendLine(`${time} ${lastState}`);
            }
            if (finalStates.includes(currentState.runState)) {
                result = currentState;
                return true;
            }
            return false;
        },
        1000, // every second
        10 * 60 * 1000); // for 10 minutes
        return result;
    }

}

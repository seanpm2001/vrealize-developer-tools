/*!
 * Copyright 2018-2020 VMware, Inc.
 * SPDX-License-Identifier: MIT
 */
import * as vscode from 'vscode';
import { getExecutionInputs, Logger, poll, VroAction, VroRestClient } from 'vrealize-common';
import { delay } from 'lodash';

export class VroActionIntegration {

    private readonly logger = Logger.get("VroActionIntegration");

    private constructor(
        private readonly vroAction: VroAction,
        private readonly serverVroAction: VroAction | null,
        private readonly restClient: VroRestClient,
        private readonly bundle?: Uint8Array) { }

    static async build(
        workspaceDir: string,
        restClient: VroRestClient,
        bundle?: Uint8Array
    ): Promise<VroActionIntegration> {
        const vroAction = await VroAction.fromPackage(workspaceDir);
        const serverVroAction = await VroAction.fromRemoteState(restClient, vroAction);
        return new VroActionIntegration(vroAction, serverVroAction, restClient, bundle);
    }

    /**
     * Push vRO action to remote server
     */
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
     * Remotely run vRO action
     */
    async run(outputChannel: vscode.OutputChannel) {

        // short circuit run
        if (!this.serverVroAction) {
            throw new Error(`Server VRO action not found`);
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Running ${this.serverVroAction.module}/${this.serverVroAction.name}`,
                cancellable: false
            },
            async () => {

                const remoteAction = this.serverVroAction as VroAction;

                const defs = await remoteAction.getRunDefinition();
                const parameters = getExecutionInputs(defs);

                outputChannel.clear();
                outputChannel.show();

                const result = await this.restClient.runPolyglotAction(remoteAction.remoteActionId as string, {
                    parameters,
                    'async-execution': true
                })
                const executionId = result['execution-id'];

                outputChannel.appendLine(`Running action ${remoteAction.module}/${remoteAction.name} (${executionId})`);
                outputChannel.appendLine(`Action inputs: ${JSON.stringify(defs, null, 2)}`);
                const output = await this.monitorExecutionRun(executionId, outputChannel);
                await this.printExecutionLogs(executionId, outputChannel);
                outputChannel.appendLine(`Run status: ${output.state} (${executionId})`);

                return output;
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
            throw new Error(`Server VRO action not found`);
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
        if (!this.bundle) {
            throw new Error(`Local bundle not found`);
        }
        await this.restClient.updatePolyglotActionBundle(actionId, this.bundle);
    }

    /**
     * Wait for action run to complete
     * @param executionId
     */
    private async monitorExecutionRun(executionId: string, outputChannel: vscode.OutputChannel): Promise<any> {
        let result = null;
        await poll(async () => {
            this.logger.debug(`Checking status of run ${executionId}`);
            const currentState = await this.restClient.getPolyglotActionRun(executionId);
            if (currentState.state !== 'running') {
                result = currentState;
                return true;
            }
            return false;
        },
        1000, // every second
        10 * 60 * 1000); // for 10 minutes
        return result;
    }

    /**
     * Print the execution logs to the execution output channel
     * @param executionId
     */
    private printExecutionLogs(executionId: string, outputChannel: vscode.OutputChannel) {

        return new Promise(resolve => {
            // allow some time for logs to appear
            delay(async () => {
                const logs = await this.restClient.getPolyglotActionRunLogs(executionId, 'debug');
                logs.logs.forEach((line: any) => {
                    const time = new Date(line.entry['time-stamp-val']).toLocaleString();
                    const level = line.entry.severity.toUpperCase();
                    const content = line.entry['short-description'];
                    outputChannel.appendLine(`${time} [${level}] ${content}`);
                });
                resolve();
            }, 1000);
        });
    }

}



/*!
 * Copyright 2018-2020 VMware, Inc.
 * SPDX-License-Identifier: MIT
 */
import * as fs from 'fs';
import * as path from 'path';

import * as jsonParser from "jsonc-parser"
import * as vscode from 'vscode';
import { getExecutionInputs, getRunDefinition, Logger, poll, VroAction, VroRestClient } from 'vrealize-common';
import { delay } from 'lodash';

export class VroActionIntegration {

    private readonly logger = Logger.get("VroActionIntegration");

    private constructor(
        private readonly workspaceDir: string,
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
        return new VroActionIntegration(workspaceDir, vroAction, serverVroAction, restClient, bundle);
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

                const defs = await getRunDefinition(remoteAction.entrypoint, this.workspaceDir);
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

    async debug() {

        // short circuit debug
        if (!this.serverVroAction) {
            throw new Error(`Server VRO action not found`);
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Debugging ${this.serverVroAction.module}/${this.serverVroAction.name}`,
                cancellable: false
            },
            async () => {

                const remoteAction = this.serverVroAction as VroAction;

                const defs = await getRunDefinition(remoteAction.entrypoint, this.workspaceDir);
                const parameters = getExecutionInputs(defs);

                const result = await this.restClient.runPolyglotAction(remoteAction.remoteActionId as string, {
                    parameters,
                    breakpoints: [{ breakpoint: { lineNumber: 0 } }],
                    'async-execution': true
                })
                const executionId = result['execution-id'];

                // update launch config
                const debugInformation = await this.restClient.getPolyglotDebugRunConfig(executionId);
                this.updateLocalRoot(debugInformation);
                await this.updateLaunchConfig(debugInformation);

                vscode.commands.executeCommand('workbench.action.debug.start');

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
    private printExecutionLogs(executionId: string, outputChannel: vscode.OutputChannel): Promise<void> {

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

    /**
     * Dynamically create launch configuration based on the
     * execution run.
     * @param debugInformation
     */
    async updateLaunchConfig(debugInformation: any) {

        this.logger.debug(JSON.stringify(debugInformation, null, 2));

        const NAME = 'vRO debug';
        const vsCodeFolder = path.join(this.workspaceDir, '.vscode');

        if (!fs.existsSync(vsCodeFolder)) {
            fs.mkdirSync(vsCodeFolder);
            vscode.workspace.fs.createDirectory(vscode.Uri.parse('.vscode'));
        }

        const launchJson = path.join(vsCodeFolder, 'launch.json');
        let launchConfig;

        if (fs.existsSync(launchJson)) {
            // read existing launch config
            launchConfig = jsonParser.parse(fs.readFileSync(launchJson, 'utf8'));
            if (launchConfig.hasOwnProperty('configurations')) {
                const targetConfiguration = launchConfig.configurations.find((c: any) => c.name === NAME);
                if (targetConfiguration) {
                    targetConfiguration.address = debugInformation.address;
                    targetConfiguration.port = debugInformation.port;
                    targetConfiguration.remoteRoot = debugInformation.remoteRoot;
                } else {
                    launchConfig.configurations.push({
                        ...debugInformation,
                        name: NAME,
                        ...(debugInformation.type === 'node' && {
                            sourceMaps: true,
                            stopOnEntry: true,
                            outFiles: ["${workspaceFolder}/out/**/*.js"] // eslint-disable-line
                        }),
                    });
                }
            }
        } else {
            // create a new launch config
            launchConfig = {
                version: "0.2.0",
                configurations: [{
                    ...debugInformation,
                    name: NAME,
                    ...(debugInformation.type === 'node' && {
                        sourceMaps: true,
                        stopOnEntry: true,
                        outFiles: ["${workspaceFolder}/out/**/*.js"] // eslint-disable-line
                    }),
                }]
            };
        }

        // write file
        fs.writeFileSync(launchJson, JSON.stringify(launchConfig, null, 4));
    }

    updateLocalRoot(debugInformation: any) {
        switch (debugInformation.type) {
            case 'python':
                debugInformation.pathMappings.forEach((pm: {localRoot: string, remoteRoot: string}) => {
                    pm.localRoot = `${pm.localRoot}/src`;
                });
                break;
            default:
                // nothing to do
        }

    }

}



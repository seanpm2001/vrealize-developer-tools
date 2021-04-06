/*!
 * Copyright 2018-2019 VMware, Inc.
 * SPDX-License-Identifier: MIT
 */

import * as vscode from "vscode"

export type ProjectTypeId =
    | "vro-ts"
    | "vro-js"
    | "vro-xml"
    | "vro-mixed"
    | "vra-yaml"
    | "vra-vro"
    | "vra-ng"
    | "polyglot"

export interface ProjectType extends vscode.QuickPickItem {
    id: ProjectTypeId
    containsWorkflows: boolean
}

export interface PolyglotType extends vscode.QuickPickItem {
    id: "vro" | "abx"
}

export interface PolyglotRuntime extends vscode.QuickPickItem {
    id: "nodejs" | "python" | "powershell"
}

export interface ProjectPickInfo {
    projectType: ProjectType
    groupId: string
    name: string
    workflowsPath?: string
    destination?: vscode.Uri
    completed: boolean
    polyglotType?: PolyglotType
    polyglotRuntime?: PolyglotRuntime
}

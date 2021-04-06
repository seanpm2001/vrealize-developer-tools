/*!
 * Copyright 2018-2020 VMware, Inc.
 * SPDX-License-Identifier: MIT
 */
import * as path from "path"

import * as fs from "fs-extra"
import * as globby from "globby"
import * as yaml from "js-yaml"
import * as ld from "lodash"
import { ActionRuntime, ActionType } from "@vmware-pscoe/polyglotpkg"

/**
 * Determine the action runtime based on the runtime entry in the action
 * definition and the action type
 * @param runtime
 * @param actionType
 */
export function getActionRuntime(runtime: string, actionType: ActionType): ActionRuntime {
    switch (runtime) {
        case "nodejs":
            return actionType === ActionType.ABX ? ActionRuntime.ABX_NODEJS : ActionRuntime.VRO_NODEJS_12
        case "powershell":
            return actionType === ActionType.ABX ? ActionRuntime.ABX_POWERSHELL : ActionRuntime.VRO_POWERCLI_11_PS_62
        case "python":
            return actionType === ActionType.ABX ? ActionRuntime.ABX_PYTHON : ActionRuntime.VRO_PYTHON_37
        default:
            return runtime as ActionRuntime
    }
}

/**
 * Return true if the value is not undefined
 * @param x
 */
export function notUndefined<T>(x: T | undefined): x is T {
    return x !== undefined
}

/**
 * Delay the executionn of a function for a given amout of time in ms.
 * @param func
 * @param ms
 */
export async function delay(func: () => void, ms: number = 1): Promise<void> {
    return await new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                func()
                resolve()
            } catch (e) {
                reject(e.message)
            }
        }, ms)
    })
}

/**
 * Execute a polling function every { interval } ms until it returns 'true'
 * or { timeout } ms have expired since the beginning of the polling
 * @param func
 * @param interval
 * @param timeoout
 */
export async function poll(
    func: () => Promise<boolean>,
    interval: number = 100,
    timeoout: number = 1000
): Promise<void> {
    return await new Promise(async (resolve, reject) => {
        let poller: NodeJS.Timeout
        const start = Date.now()
        const endTime = start + timeoout

        async function runPoller() {
            try {
                if (await func()) {
                    clearInterval(poller)
                    resolve()
                } else if (Date.now() >= endTime) {
                    throw new Error(
                        `Timeout: polling function did not return a truthy value within the required timeout: ${timeoout}`
                    )
                }
            } catch (err) {
                reject(err)
            }
        }

        // run immediately
        if (await func()) {
            resolve()
        } else {
            poller = setInterval(runPoller, interval)
        }
    })
}

/**
 * Read and parse action run defintion from an accompaning .yaml file
 * @param entrypoint action entrypoint
 */
export async function getRunDefinition(entrypoint: string, workspaceDir: string) {
    // parse the entrypoint and look for debug definitions
    const entrypointModule = path.basename(entrypoint.split(".")[0])
    const runDefs = globby.sync([`**/${entrypointModule}.debug.{yaml,yml,json}`, "!**/node_modules/**"], {
        cwd: workspaceDir,
        absolute: true
    })
    let runDefsObj
    if (runDefs.length > 0) {
        if (runDefs[0].endsWith(".json")) {
            runDefsObj = await fs.readJSON(runDefs[0])
        } else {
            const runDefsYAML = (await fs.readFile(runDefs[0])).toString()
            runDefsObj = yaml.safeLoad(runDefsYAML) as { [key: string]: any }
        }
    }
    return runDefsObj || {}
}

/**
 * Get a list of execution inputs from plain object
 * structure in the form of
 * {
 *   foo: 'my string input',
 *   bar: [42, 23],
 *   baz: {
 *     answer: 42,
 *     everything: true
 *   }
 * }
 * @param inputs
 */
export function getExecutionInputs(inputs: any) {
    return Object.entries(inputs).map(([key, value]) => {
        const valueType = getVroType(value)
        return {
            name: key,
            type: valueType,
            value: {
                // value representation
                [valueType.toLowerCase()]: resolveVroType(value)
            }
        }
    })
}

/**
 * Resolve a vRO tyoe to a API-compatible structure,
 * e.g. ['a'] will be resolved to
 * {
 *   elements: [
 *     {
 *       string: {
 *         value: 'a'
 *       }
 *     }
 *   ]
 * }
 * @param val - any kind of value
 */
function resolveVroType(val: any): any {
    if (ld.isArray(val)) {
        // resolve arrays to object with 'elements' property
        // with each element resolving to respective type representation
        return {
            elements: val.map(entry => {
                const valueType = getVroType(entry)
                return { [valueType.toLowerCase()]: resolveVroType(entry) }
            })
        }
    } else if (ld.isObject(val)) {
        // resolve objects to object with 'property' property
        // with each property resolving to an object with key = propertyName
        // and value resolving to respective type representation
        return {
            property: Object.entries(val).map(entry => {
                const [key, val] = entry
                const valueType = getVroType(val)
                return {
                    key: key,
                    value: {
                        [valueType.toLowerCase()]: resolveVroType(val)
                    }
                }
            })
        }
    }
    // resolve primitive types to value representation in the form of
    // an object with 'value' property = the value
    return { value: val }
}

/**
 * Get vRO-compliant type from primitive and
 * complex types.
 * @param val
 */
function getVroType(val: any) {
    if (ld.isString(val)) {
        return "string"
    }
    if (ld.isNumber(val)) {
        return "number"
    }
    if (ld.isBoolean(val)) {
        return "boolean"
    }
    if (ld.isArray(val)) {
        return "Array"
    }
    if (ld.isObject(val)) {
        return "Properties"
    }
    return "any"
}

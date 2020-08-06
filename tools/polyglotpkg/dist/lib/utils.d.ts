import { ActionType, ActionRuntime, AbxActionDefinition, VroActionDefinition } from './model';
/**
 * Determine the action runtime based on the action manifest or
 * the action handler if runtime is not specified.
 * @param projectPath
 */
export declare function determineRuntime(projectPath: string, actionType?: ActionType): Promise<ActionRuntime>;
/**
 * Determine the action type based on the action manifest.
 */
export declare function determineActionType(projectPath: string, actionType?: ActionType): Promise<ActionType>;
/**
 * Return the parsed content of the project's package.
 */
export declare function getActionManifest(projectPath: string): Promise<AbxActionDefinition | VroActionDefinition | null>;
/**
 * Return true if the value is not undefined
 * @param x
 */
export declare function notUndefined<T>(x: T | undefined): x is T;
/**
 * Run external command and wait for it to complete
 * @param cmd
 */
export declare function run(cmd: string, args?: Array<string>, cwd?: string): Promise<number>;

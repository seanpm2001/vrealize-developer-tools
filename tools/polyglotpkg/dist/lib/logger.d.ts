/// <reference types="node" />
import { Logger } from 'winston';
import { Writable } from 'stream';
export default function createLogger(verbose?: boolean, outputStream?: Writable): Logger;

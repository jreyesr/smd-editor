import {Device} from "$lib/device";

export type ContextMenuEntry = {
    displayName: string,
    constructor: new (...args: any[]) => Device,
    params?: any[]
}

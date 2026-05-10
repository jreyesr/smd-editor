import {Loader} from "excalibur";

// It is convenient to put your resources in one place
export const Resources = {} as const;

export const loader = new Loader();
// for (const res of Object.values(Resources)) {
// loader.addResource(res);
// }

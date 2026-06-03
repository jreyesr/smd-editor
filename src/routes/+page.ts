import type {PageLoad} from './$types';
import {listDesigns} from "$lib/store";

export const load: PageLoad = async ({params}) => {
    return {
        designs: await listDesigns()
    }
}
export const ssr = false
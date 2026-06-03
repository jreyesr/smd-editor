import type {PageLoad} from './$types';
import {getDesign} from "$lib/store";

export const load: PageLoad = async ({params}) => {
    return getDesign(params.id)
}
export const ssr = false
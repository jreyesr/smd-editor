import type {SerializedDevice} from "$lib/device";
import {type DBSchema, openDB} from "idb";

export type StoredDesign = {
    id: number,
    name: string,
    data: SerializedDevice[],
    thumbnail?: string,
}
export type ExportedDesign = Pick<StoredDesign, "name" | "data">

interface DB extends DBSchema {
    designs: {
        value: {
            id?: number,
            name: string;
            data: any[];
            dateCreated: string;
            thumbnail?: string;
        };
        key: number;
    };
}


function getDB() {
    return openDB<DB>('smd-editor', 1, {
        upgrade(db, oldVersion) {
            if (oldVersion < 1) {
                db.createObjectStore('designs', {
                    keyPath: "id",
                    autoIncrement: true
                })
            }
        }
    })
}

export async function listDesigns(): Promise<StoredDesign[]> {
    const db = await getDB()
    return (await db.getAll('designs')) as StoredDesign[]
}

export async function createDesign(): Promise<string> {
    const db = await getDB()
    return (await db.add('designs', {
        name: "My New Design",
        dateCreated: new Date().toISOString(),
        data: []
    })).toString()
}

export async function importDesign(data: ExportedDesign): Promise<string> {
    const db = await getDB()
    return (await db.add('designs', {
        name: data.name,
        dateCreated: new Date().toISOString(),
        data: data.data
    })).toString()
}

export async function getDesign(id: string): Promise<StoredDesign> {
    const db = await getDB()
    return (await db.get("designs", parseInt(id))) as StoredDesign
}

export async function saveDesign(id: string, data: StoredDesign["data"], thumbnail?: string) {
    const db = await getDB()
    const currentVersion = (await db.get('designs', parseInt(id)))!

    await db.put("designs", {...currentVersion, data, thumbnail, id: parseInt(id)})
}

export async function saveDesignScreenshot(id: string, thumbnail: string) {
    const db = await getDB()
    const currentVersion = (await db.get('designs', parseInt(id)))!

    await db.put("designs", {...currentVersion, thumbnail, id: parseInt(id)})
}

export async function updateDesignName(id: string, newName: string) {
    const db = await getDB()
    const currentVersion = (await db.get('designs', parseInt(id)))!

    await db.put("designs", {...currentVersion, name: newName, id: parseInt(id)})
}

export async function deleteDesign(id: string) {
    const db = await getDB()
    return await db.delete("designs", parseInt(id))
}

import type {SerializedDevice} from "$lib/device";
import {type DBSchema, openDB} from "idb";

export type StoredDesign = {
    id: number,
    name: string,
    data: SerializedDevice[]
}

interface DB extends DBSchema {
    designs: {
        value: {
            id?: number,
            name: string;
            data: any[];
            dateCreated: string;
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

export async function getDesign(id: string): Promise<StoredDesign> {
    const db = await getDB()
    return (await db.get("designs", parseInt(id))) as StoredDesign
}

export async function saveDesign(id: string, data: StoredDesign["data"]) {
    const db = await getDB()
    const currentVersion = (await db.get('designs', parseInt(id)))!

    await db.put("designs", {...currentVersion, data, id: parseInt(id)})
}
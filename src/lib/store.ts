import type {SerializedDevice} from "$lib/device";

export type StoredDesign = {
    id: string,
    name: string,
    data: SerializedDevice[]
}

export async function listDesigns(): Promise<StoredDesign[]> {
    if (localStorage.getItem("currentWork")) {
        return [{
            id: "single",
            name: "My Design",
            data: JSON.parse(localStorage.getItem("currentWork")!)
        }]
    }
    return []
}

export async function createDesign(): Promise<string> {
    return "single"
}

export async function getDesign(id: string): Promise<StoredDesign> {
    return {
        id: id,
        name: "My Design",
        data: JSON.parse(localStorage.getItem("currentWork") || "[]")
    }
}

export async function saveDesign(id: String, data: StoredDesign["data"]) {
    localStorage.setItem("currentWork", JSON.stringify(data))
}
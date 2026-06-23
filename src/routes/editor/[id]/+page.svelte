<script lang="ts">
    import type {PageProps} from './$types';
    import {
        getDataToSave,
        hookChangeNotifier,
        initializeEmptyDesign,
        loadDataIntoCanvas,
        setupEditor,
        takeCanvasScreenshot
    } from "$lib/editor";
    import {type Canvas} from "fabric";
    import ContextMenu from './contextMenu.svelte';
    import {components} from "$lib/device";
    import {saveDesign, saveDesignScreenshot, updateDesignName} from "$lib/store";
    import {beforeNavigate} from "$app/navigation";
    import {onMount} from "svelte";
    import {type DebugOptions, setupDebugPane, setupDebugViews} from "$lib/debug";
    import {type FolderApi, Pane} from "tweakpane";
    import * as EssentialsPlugin from "@tweakpane/plugin-essentials";

    let {data}: PageProps = $props();
    let name = $state(data.name);

    let paramsPaneEl: HTMLElement;
    let paramsPane = $state<Pane>();
    let paramsPaneVisible = $state(false)
    onMount(() => {
        paramsPane = new Pane({container: paramsPaneEl, title: "Config"})
        paramsPane.registerPlugin(EssentialsPlugin)
        paramsPane.hidden = true
        paramsPane.controller.rackController.rack.emitter.on("layout", (ev) => {
            const anyVisible = ev.sender.children.some(x => x.viewProps.value("hidden").rawValue === false && !x.viewProps.value("disposed").rawValue)
            paramsPane!.hidden = !anyVisible
            paramsPaneVisible = !paramsPane!.hidden
        })
    })

    let canvasEl: HTMLCanvasElement;
    let canvas: Canvas | null = $state(null)
    let isDirty = $state(false)
    onMount(() => {
        if (!canvas) { // don't double-initialize the canvas
            canvas = setupEditor(canvasEl)
        }
        if (!data.data) return;

        canvas.clear()
        if (data.data.length === 0) {
            initializeEmptyDesign(canvas)
        } else {
            loadDataIntoCanvas(canvas, data.data, paramsPane!)
        }
        // only hook this once loaded, otherwise the act of loading/init'ing the canvas already marks it as dirty
        return hookChangeNotifier(canvas, () => {
            isDirty = true
        })
    })

    beforeNavigate((navigation) => {
        if (isDirty) {
            if (navigation.type == "leave") {
                navigation.cancel()
            } else {
                saveCurrentDesign()
            }
        }
    })

    async function saveCurrentDesign() {
        const dataToSave = getDataToSave(canvas!)
        const screenshot = takeCanvasScreenshot(canvas!)
        await saveDesign(data.id.toString(), dataToSave, screenshot)
        isDirty = false
    }

    async function updateName(ev: FocusEvent) {
        await updateDesignName(data.id.toString(), (ev.target as HTMLInputElement).value)
        const screenshot = takeCanvasScreenshot(canvas!)
        await saveDesignScreenshot(data.id.toString(), screenshot)
    }

    function updateNameFromKey(ev: KeyboardEvent) {
        if (ev.code === "Enter" || ev.code === "NumpadEnter") {
            (ev.target as HTMLInputElement).blur() // this will fire the actual save
        }
    }

    let drawDebugLayers = $state<DebugOptions>({enableQuadtree: false, enableRatsnest: false, enableCollisions: false})
    $effect(() => {
        if (!canvas) return;
        const debugRenderDisposer = setupDebugViews(canvas, drawDebugLayers)
        canvas.requestRenderAll()
        return debugRenderDisposer
    })
    let debugPane: FolderApi
    onMount(() => {
        if (!paramsPane || !canvas) return;
        debugPane = paramsPane.addFolder({hidden: true, title: "Debug"})
        setupDebugPane(debugPane, canvas, drawDebugLayers)
        // @ts-expect-error toggleDebug is a custom event emitted on Canvas, so it isn't normally typed
        return canvas.on("toggleDebug", () => {
            debugPane.hidden = !debugPane.hidden
        })
    })
</script>

<h1>
    <input id="name" value={name} onblur={updateName} onkeydown={updateNameFromKey}/>
    <button id="save" onclick={saveCurrentDesign} disabled={!isDirty}>Save</button>
</h1>

<ul class="instructions">
    <li>Double click → configure device properties</li>
    <li>Right click → add new device</li>
    <li>R/⇧+R → rotate ↻/↺ resp.</li>
    <li>Del/Bksp → delete</li>
    <li>WASD → move</li>
    <li>$ → toggle the debug panel</li>
</ul>

<canvas id="editor" bind:this={canvasEl}></canvas>

<!-- these must be below the canvas so they appear on top of it -->
<button id="tweakpaneOpenButton" onclick={()=>{debugPane!.hidden=false}} hidden={paramsPaneVisible}>⚙</button>
<div id="tweakpaneControls" bind:this={paramsPaneEl}></div>
<ContextMenu options={components} canvas={canvas!} paramsPane={paramsPane!}/>

<style>
    #tweakpaneControls {
        position: absolute;
        right: 10px;
        top: 0;

        :global(.tp-rotv) { /* hacky but dev-approved: https://github.com/cocopon/tweakpane/issues/395 */
            font-size: medium;
            border-radius: 0 0 var(--bs-br) var(--bs-br);
        }
    }

    #tweakpaneOpenButton {
        --bs-bg: var(--tp-base-background-color, hsl(230, 7%, 17%));
        --bs-br: var(--tp-base-border-radius, 6px);
        --bs-ff: var(--tp-base-font-family);
        --bs-sh: var(--tp-base-shadow-color, rgba(0, 0, 0, 0.2));
        --cnt-bg: var(--tp-container-background-color, rgba(187, 188, 196, 0.1));
        --cnt-bg-a: var(--tp-container-background-color-active, rgba(187, 188, 196, 0.25));
        --cnt-bg-f: var(--tp-container-background-color-focus, rgba(187, 188, 196, 0.2));
        --cnt-bg-h: var(--tp-container-background-color-hover, rgba(187, 188, 196, 0.15));
        --cnt-fg: var(--tp-container-foreground-color, hsl(230, 7%, 75%));

        position: absolute;
        top: 0;
        right: 10px;
        width: 60px;
        height: 40px;
        background-color: var(--bs-bg);
        color: var(--cnt-fg);
        border-radius: 0 0 var(--bs-br) var(--bs-br);
        box-shadow: 0 2px 4px var(--bs-sh);
        font-family: var(--bs-ff);
        font-size: x-large;
        text-align: center;
        align-content: center;
        cursor: pointer;

        &:hover {
            background-color: color-mix(in srgb, var(--bs-bg) 85%, transparent 15%);
        }
    }

    #editor {
        border: 1px solid lightgray;
    }

    #save {
        padding: 0.5em 1em;
        font-size: medium;

        &:not(:disabled) {
            background-color: aquamarine;
            border: 3px solid mediumaquamarine;
            border-radius: 5px;
        }
    }

    input#name {
        border: none;
        font-size: 1em;
        font-weight: bold;
        border-bottom: 1px solid lightgrey;

        &:focus {
            outline: none;
            border-bottom: 1px solid black;
        }
    }
</style>

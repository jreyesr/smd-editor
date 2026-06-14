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
    import {saveDesign, updateDesignName} from "$lib/store";
    import {beforeNavigate} from "$app/navigation";
    import {onMount} from "svelte";
    import {type DebugOptions, setupDebugPane, setupDebugViews} from "$lib/debug";
    import {Pane} from "tweakpane";
    import * as EssentialsPlugin from "@tweakpane/plugin-essentials";

    let {data}: PageProps = $props();
    let name = $state(data.name);

    let canvasEl: HTMLCanvasElement;
    let paramsPane: HTMLElement;
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
            loadDataIntoCanvas(canvas, data.data, paramsPane)
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

    function updateName(ev: FocusEvent) {
        updateDesignName(data.id.toString(), (ev.target as HTMLInputElement).value)
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
    onMount(() => {
        if (!paramsPane || !canvas) return;
        const debugPane = new Pane({container: paramsPane, title: "Debug"})
        debugPane.hidden = true
        debugPane.registerPlugin(EssentialsPlugin)
        setupDebugPane(debugPane, canvas, drawDebugLayers)
        // @ts-expect-error toggleDebug is a custom event emitted on Canvas, so it isn't normally typed
        return canvas.on("toggleDebug", () => {
            debugPane.hidden = !debugPane.hidden
        })
    })
</script>

<!--<div class="persistence-warning">
    <p><b>WARNING!</b></p>
    <p>Don't do too much work on this editor! It doesn't currently have any way of saving and restoring data, so
        anything you do here will be lost on page refresh. You've been warned.</p>
</div>-->

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
    <li>º → open the debug panel</li>
</ul>

<div id="tweakpaneControls" bind:this={paramsPane}></div>
<ContextMenu options={components} canvas={canvas!} paramsPane={paramsPane}/>

<canvas id="editor" bind:this={canvasEl}></canvas>

<style>
    /*.persistence-warning {*/
    /*    background-color: orange;*/
    /*    padding: 1em;*/
    /*    margin: 1em;*/
    /*}*/

    #tweakpaneControls {
        position: absolute;
        right: 10px;
        top: 10px;

        /* hacky but dev-approved: https://github.com/cocopon/tweakpane/issues/395 */
        :global(.tp-rotv) {
            font-size: medium;
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
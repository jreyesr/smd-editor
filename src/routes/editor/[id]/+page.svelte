<script lang="ts">
    import type {PageProps} from './$types';
    import {initializeEmptyDesign, loadDataIntoCanvas, setupDebugViews, setupEditor} from "$lib/editor";
    import {type Canvas, Path} from "fabric";
    import ContextMenu from './contextMenu.svelte';
    import {components, Device, type SerializedDevice} from "$lib/device";
    import {SP1_50x50, ThroughHoleProtoboard} from "$lib/board";
    import {saveDesign} from "$lib/store";

    let {data}: PageProps = $props();

    let canvasEl: HTMLCanvasElement;
    let paramsPane: HTMLElement;
    let canvas: Canvas | null = $state(null)
    $effect(() => {
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
    })

    function saveCurrentDesign() {
        const dataToSave = canvas!.getObjects()
            .map(obj => {
                if (obj instanceof Device) return {obj, data: obj.save()}
                else if (obj instanceof Path) return {obj, data: {path: obj.path}}
                else if (obj instanceof SP1_50x50 || obj instanceof ThroughHoleProtoboard) return {
                    obj,
                    data: {sizeX: obj.numPadsX, sizeY: obj.numPadsY}
                }
                return undefined
            })
            .filter(x => x !== undefined)
            .map(({obj, data}): SerializedDevice => ({
                type: obj.type,
                x: obj.getX(), y: obj.getY(), rotation: obj.angle,
                extraData: data
            }))
        saveDesign(data.id.toString(), dataToSave)
    }

    let enableQuadtree = $state(false)
    let enableRatsnest = $state(false)
    $effect(() => {
        if (!canvas) return;
        const debugRenderDisposer = setupDebugViews(canvas, enableQuadtree, enableRatsnest)
        canvas.requestRenderAll()
        return debugRenderDisposer
    })
</script>

<div class="persistence-warning">
    <p><b>WARNING!</b></p>
    <p>Don't do too much work on this editor! It doesn't currently have any way of saving and restoring data, so
        anything you do here will be lost on page refresh. You've been warned.</p>
</div>

<h1>{data.name}
    <button onclick={saveCurrentDesign}>Save</button>
</h1>

<ul class="instructions">
    <li>Double click → configure device properties</li>
    <li>Right click → add new device</li>
    <li>R/⇧+R → rotate ↻/↺ resp.</li>
    <li>Del/Bksp → delete</li>
    <li>WASD → move</li>
    <li><label><input type="checkbox" bind:checked={enableQuadtree}>quadtree</label></li>
    <li><label><input type="checkbox" bind:checked={enableRatsnest}>ratsnest</label></li>
</ul>

<div id="tweakpaneControls" bind:this={paramsPane}></div>
<ContextMenu options={components} canvas={canvas!} paramsPane={paramsPane}/>

<canvas id="editor" bind:this={canvasEl}></canvas>

<style>
    .persistence-warning {
        background-color: orange;
        padding: 1em;
        margin: 1em;
    }

    #tweakpaneControls {
        position: absolute;
        right: 10px;
        top: 10px;
    }

    #editor {
        border: 1px solid lightgray;
    }
</style>
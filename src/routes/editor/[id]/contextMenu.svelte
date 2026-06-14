<script lang="ts">
    import {Canvas, Path} from "fabric";
    import {addDeviceToCanvas, onSolderAdded} from "$lib/editor";
    import type {ContextMenuEntry} from "./contextMenu";
    import {type Pane} from "tweakpane";

    let popoverEl: HTMLElement;

    let {options, canvas, paramsPane}: {
        options: ContextMenuEntry[],
        canvas: Canvas,
        paramsPane: Pane
    } = $props();
    let lastShowEvent: MouseEvent | null = $state(null)

    $effect(() => {
        if (!canvas) return

        const contextMenuDiscarder = canvas.on("contextmenu", (event) => {
            event.e.preventDefault()

            lastShowEvent = event.e as MouseEvent
            popoverEl.showPopover()
        })

        return contextMenuDiscarder
    })

    function onAddDevice(deviceKind: ContextMenuEntry) {
        popoverEl.hidePopover()

        const newDevice = new deviceKind.constructor(...(deviceKind.params || []))
        addDeviceToCanvas(canvas, newDevice, paramsPane)
        canvas.setActiveObject(newDevice)

        const pointOfLastRightClick = canvas.getViewportPoint(lastShowEvent!)
        newDevice.setXY(pointOfLastRightClick)

        newDevice.setCoords();
        canvas.requestRenderAll();

        newDevice.fire("moving") // recompute collisions
    }

    function onAddSolder() {
        canvas.isDrawingMode = true
        popoverEl.hidePopover()

        canvas.once("path:created", (ev) => {
            onSolderAdded(canvas, ev.path as Path)
            canvas.isDrawingMode = false
        })
    }
</script>

<div class="context-menu" popover="auto"
     bind:this={popoverEl}
     style:top={lastShowEvent?.clientY + "px"} style:left={lastShowEvent?.clientX + "px"}>
    {#each options as deviceKind}
        <button class="context-menu-option" onclick={() => onAddDevice(deviceKind)}>+ {deviceKind.displayName}</button>
    {/each}
    <button class="context-menu-option" onclick={()=>onAddSolder()}>Solder</button>
</div>

<style>
    /* based on https://konvajs.org/docs/sandbox/Canvas_Context_Menu.html */
    .context-menu {
        position: absolute;
        width: 200px;
        background-color: white;
        box-shadow: 0 0 5px grey;
        border-radius: 3px;
        margin: 0;

        & .context-menu-option {
            width: 100%;
            background-color: white;
            border: none;
            margin: 0;
            padding: 10px;
            text-align: start;

            &:hover {
                background-color: lightgray;
                font-weight: bold;
            }
        }
    }
</style>
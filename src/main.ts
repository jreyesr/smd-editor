import {
    Canvas,
    classRegistry,
    controlsUtils,
    FabricText,
    InteractiveFabricObject,
    Path,
    PencilBrush
} from "fabric";
import {components, Device, SerializedDevice} from "./device";
import {SP1_50x50} from "./board";
import {collisionManager} from "./collisions";
import {Quadtree} from "@timohausmann/quadtree-ts";
import {Pane} from "tweakpane";
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';

FabricText.ownDefaults.fontFamily = 'sans-serif';
InteractiveFabricObject.createControls = () => ({controls: {}});
const controls = controlsUtils.createObjectDefaultControls()
InteractiveFabricObject.ownDefaults = {
    ...InteractiveFabricObject.ownDefaults,
    cornerSize: 9,
    cornerColor: "green",
    transparentCorners: false,
    controls: {rotation: controls.mtr}, // only leave the rotation control (and movement because that isn't on a corner control)
    snapAngle: 90 // so things turn in 90º increments only (NSEW)
}

const canvasElement = document.getElementById("editor") as HTMLCanvasElement
const canvas = new Canvas(canvasElement, {
    width: 1600, height: 750,
});

canvas.freeDrawingBrush = new PencilBrush(canvas)
canvas.freeDrawingBrush.color = "blue"
export const solderWidth = 25, solderRadius = solderWidth / 2;
canvas.freeDrawingBrush.width = 25;
(canvas.freeDrawingBrush as PencilBrush).decimate = 10

canvas.elements.upper.el.tabIndex = -1
canvas.elements.upper.el.addEventListener("keydown", function (ev) {
    const target = canvas.getActiveObject()
    const deltaAngle = ev.shiftKey ? -90 : 90
    const deltaMovement = ev.shiftKey ? 50 : 10
    if (!target) return

    switch (ev.key) {
        case "Delete":
        case "Backspace":
            const toDelete = canvas.getActiveObjects()
            canvas.remove(...toDelete)
            canvas.discardActiveObject() // otherwise there's a ghost selection left if you delete a group of shapes
            break
        case "r":
        case "R":
            target.animate({
                angle: target.angle + deltaAngle
            }, {
                duration: 50,
                onChange: () => {
                    // HACKish: requestRenderAll marks for redraw since an object has changed, otherwise it doesn't rerender until something is dragged,
                    // see https://fabricjs.com/docs/old-docs/gotchas/#object-does-not-update-after-changing-property---objectcaching
                    // setCoords is because without it the corner controls (e.g. for rotation) stay behind (in their original positions)
                    // until the animation is completed, see https://stackoverflow.com/questions/52283622/fabricjs-rotate-object-without-moving-the-position#comment94141813_52683341
                    canvas.requestRenderAll()
                    target.setCoords()
                },
                onComplete: () => {
                    target.fire("moving")
                }
            })
            break
        case "ArrowUp":
        case "W":
        case "w":
            target.setY(target.getY() - deltaMovement)
            break
        case "ArrowDown":
        case "S":
        case "s":
            target.setY(target.getY() + deltaMovement)
            break
        case "ArrowLeft":
        case "A":
        case "a":
            target.setX(target.getX() - deltaMovement)
            break
        case "ArrowRight":
        case "D":
        case "d":
            target.setX(target.getX() + deltaMovement)
            break
    }

    // trigger a redraw because we likely changed some graphics
    canvas.requestRenderAll()
    target.setCoords()
    target.fire("moving") // because most actions will move the targeted object
})

const ui = document.getElementById('ui')!
const pane = document.getElementById("controls")!

function addDeviceToCanvas(dev: Device | Path) {
    canvas.add(dev)

    if (dev instanceof Device) {
        dev.fire("moving") // to prod the collision detector
        dev.on("mousedblclick", function () {
            const paramsPane = new Pane({container: pane, title: dev.type})
            paramsPane.registerPlugin(EssentialsPlugin)
            dev.setupParametersPane(paramsPane)
            dev.once("deselected", function () {
                paramsPane.dispose()
            })
        })
    }
}

for (let deviceKind of components) {
    const btn = document.createElement("button")
    btn.textContent = "+ " + deviceKind.displayName
    btn.addEventListener("click", () => {
        const newDevice = new deviceKind.constructor(...(deviceKind.params || []))
        addDeviceToCanvas(newDevice)
        canvas.centerObject(newDevice)
        newDevice.fire("moving") // recompute collisions
    })
    ui.appendChild(btn)
}

// solder lines button
const solderBtn = document.createElement("button")
solderBtn.textContent = "Solder"
solderBtn.addEventListener("click", (e) => {
    solderBtn.disabled = true
    canvas.isDrawingMode = true

    canvas.once("path:created", ({path}: { path: Path }) => {
        // stack should always be as follows: base protoboard at the bottom, then all the solder Paths, then the components
        const allElemsExceptThisPath = canvas.getObjects().slice(0, -1)
        let topmostPathPosition = allElemsExceptThisPath.findLastIndex(e => e instanceof Path)
        if (topmostPathPosition === -1) { // if this is the first path, start the stack just above the protoboard
            topmostPathPosition = 0
        }
        canvas.moveObjectTo(path, topmostPathPosition + 1) // push it down until it meets with the other Paths

        collisionManager.addElement(path)
        path.fire("moving") // convince the collmanager to compute it

        solderBtn.disabled = false
        canvas.isDrawingMode = false
    })
})
ui.appendChild(solderBtn)

const saveBtn = document.createElement("button")
saveBtn.textContent = "Save"
saveBtn.addEventListener("click", () => {
    const dataToSave = canvas.getObjects()
        .map(obj => {
            if (obj instanceof Device) return {obj, data: obj.save()}
            else if (obj instanceof Path) return {obj, data: {path: obj.path}}
            return undefined
        })
        .filter(x => x !== undefined)
        .map(({obj, data}): SerializedDevice => ({
            type: obj.type,
            x: obj.getX(), y: obj.getY(), rotation: obj.angle,
            extraData: data
        }))
    localStorage.setItem("currentWork", JSON.stringify(dataToSave))
})
ui.appendChild(saveBtn)

canvas.add(new SP1_50x50())
if (localStorage.getItem("currentWork")) {
    const savedData = JSON.parse(localStorage.getItem("currentWork")!) as SerializedDevice[]
    for (let storedObject of savedData) {
        const klass: (typeof Device | typeof Path) = classRegistry.getClass(storedObject.type)
        let refreshedObject: Device | Path
        if (klass.prototype instanceof Device) {
            // TODO is there any way to collaborate with the type checker here?
            refreshedObject = (klass as typeof Device).load(storedObject.extraData)
        } else {
            // it's a solder line (a Path)
            refreshedObject = (canvas.freeDrawingBrush as PencilBrush).createPath(storedObject.extraData.path)
        }
        refreshedObject.setX(storedObject.x)
        refreshedObject.setY(storedObject.y)
        refreshedObject.set("angle", storedObject.rotation)

        addDeviceToCanvas(refreshedObject)
    }
}

canvas.on("object:moving", function (ev) {
    ev.target.fire("moving", ev)
})

let DEBUG_QUADTREE = false
document.getElementById("debugQuadtree")!.onchange = function (ev) {
    DEBUG_QUADTREE = (ev.target as HTMLInputElement).checked
    canvas.requestRenderAll()
}
canvas.on("after:render", function ({ctx}) {
    if (!DEBUG_QUADTREE) return
    const colorNode = 'rgba(255,0,0,0.5)';

    /* this comes from https://github.com/timohausmann/quadtree-ts/blob/4ab917a58cd7b7c7e7289c4dc0bc3ee2e2c9ee3e/docs/examples/assets/examples.js#L8
    * Copyright (c) 2012-2023 Timo Hausmann */
    function drawQuadtree(node: Quadtree<any>, ctx: CanvasRenderingContext2D) {
        //no subnodes? draw the current node
        if (node.nodes.length === 0) {
            ctx.strokeStyle = colorNode;
            ctx.strokeRect(node.bounds.x, node.bounds.y, node.bounds.width, node.bounds.height);

            //has subnodes? drawQuadtree them!
        } else {
            for (let i = 0; i < node.nodes.length; i = i + 1) {
                drawQuadtree(node.nodes[i], ctx);
            }
        }
    }

    drawQuadtree(collisionManager._quadtree, ctx)
})
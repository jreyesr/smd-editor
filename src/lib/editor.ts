import {
    ActiveSelection,
    Canvas,
    classRegistry,
    controlsUtils,
    FabricText,
    InteractiveFabricObject,
    Path,
    PencilBrush
} from "fabric";
import {Device, type SerializedDevice} from "$lib/device";
import {SP1_50x50, ThroughHoleProtoboard} from "./board";
import {Pane} from "tweakpane";
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import {collisionManager} from "$lib/collisions";
import type {Quadtree} from "@timohausmann/quadtree-ts";


FabricText.ownDefaults.fontFamily = 'sans-serif';
InteractiveFabricObject.createControls = () => ({controls: {}});
const controls = controlsUtils.createObjectDefaultControls()
InteractiveFabricObject.ownDefaults = {
    ...InteractiveFabricObject.ownDefaults,
    cornerSize: 12,
    cornerColor: "green",
    transparentCorners: false,
    controls: {rotation: controls.mtr}, // only leave the rotation control (and movement because that isn't on a corner control)
    snapAngle: 90 // so things turn in 90º increments only (NSEW)
}

export function onSolderAdded(canvas: Canvas, path: Path) {
    // stack should always be as follows: base protoboard at the bottom, then all the solder Paths, then the components
    const allElemsExceptThisPath = canvas.getObjects().slice(0, -1)
    let topmostPathPosition = allElemsExceptThisPath.findLastIndex(e => e instanceof Path)
    if (topmostPathPosition === -1) { // if this is the first path, start the stack just above the protoboard
        topmostPathPosition = 0
    }
    canvas.moveObjectTo(path, topmostPathPosition + 1) // push it down until it meets with the other Paths

    collisionManager.addElement(path)
    path.fire("moving") // convince the collmanager to compute it
}


export function addDeviceToCanvas(canvas: Canvas, dev: Device | Path | SP1_50x50 | ThroughHoleProtoboard, paramsPaneEl: HTMLElement) {
    canvas.add(dev)

    if (dev instanceof Device || dev instanceof SP1_50x50 || dev instanceof ThroughHoleProtoboard) {
        dev.fire("moving") // to prod the collision detector, does nothing for the Board devices
        dev.on("mousedblclick", function () {
            const paramsPane = new Pane({container: paramsPaneEl, title: dev.type})
            paramsPane.registerPlugin(EssentialsPlugin)
            dev.setupParametersPane(paramsPane)
            dev.once("deselected", function () {
                paramsPane.dispose()
            })
        })
    } else if (dev instanceof Path) {
        onSolderAdded(canvas, dev)
    }
}

export function getDataToSave(canvas: Canvas) {
    return canvas.getObjects()
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
}

export function loadDataIntoCanvas(canvas: Canvas, data: SerializedDevice[], paramsPane: HTMLElement) {
    for (let storedObject of data) {
        const klass: (typeof Device | typeof Path | typeof SP1_50x50 | typeof ThroughHoleProtoboard) = classRegistry.getClass(storedObject.type)
        let refreshedObject: Device | Path | SP1_50x50 | ThroughHoleProtoboard
        if (klass.prototype instanceof Device)
            refreshedObject = (klass as typeof Device).load(storedObject.extraData)
        else if (klass === SP1_50x50 || klass === ThroughHoleProtoboard)
            refreshedObject = new klass(storedObject.extraData.sizeX, storedObject.extraData.sizeY)
        else if (klass === Path)
            refreshedObject = (canvas.freeDrawingBrush as PencilBrush).createPath(storedObject.extraData.path)
        else {
            console.error("Unknown class can't be loaded from LocalStorage", klass)
            continue
        }

        refreshedObject.setX(storedObject.x)
        refreshedObject.setY(storedObject.y)
        refreshedObject.set("angle", storedObject.rotation)

        addDeviceToCanvas(canvas, refreshedObject, paramsPane)
    }
}

export function initializeEmptyDesign(canvas: Canvas) {
    canvas.add(new SP1_50x50())
}

export function setupEditor(canvasEl: HTMLCanvasElement): Canvas {
    const canvas = new Canvas(canvasEl, {
        width: 1500, height: 750,
        stopContextMenu: false,
    });

    canvas.freeDrawingBrush = new PencilBrush(canvas)
    canvas.freeDrawingBrush.color = "blue"
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

    canvas.on("object:moving", function (ev) {
        ev.target.fire("moving", ev)

        // must forward the move event that fires on the ActiveSelection to each of the selected elements
        // because the colldet hooks into each object's "moving" event
        if (ev.target instanceof ActiveSelection) {
            for (let selectedItem of ev.target.getObjects()) {
                selectedItem.fire("moving", ev)
            }
        }
    })

    return canvas
}

export function setupDebugViews(canvas: Canvas, enableQuadtree: boolean, enableRatsnest: boolean) {
    return canvas.on("after:render", function ({ctx}) {
        if (enableQuadtree) {
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

            ctx.save()
            drawQuadtree(collisionManager._quadtree, ctx)
            ctx.restore()
        }

        if (enableRatsnest) {
            const colorRatsnestLines = 'magenta';

            ctx.save()
            ctx.strokeStyle = colorRatsnestLines
            ctx.setLineDash([4, 4])
            ctx.lineWidth = 3

            const connectedComponents = collisionManager.getConnectedSets()
            for (let net of connectedComponents) {
                let isFirst = true
                for (let component of net) {
                    if (component.type.endsWith("/pad") || component.type === "path") {
                        // don't count board pads or solder lines on the ratsnest, only actual LayoutSvelte pads/pins
                        continue
                    }

                    if (isFirst) {  // only happens on the first loop
                        ctx.moveTo(component.getX(), component.getY())
                        isFirst = false
                    } else {
                        // add another point to the line
                        ctx.lineTo(component.getX(), component.getY())
                    }
                    // ctx.arc(LayoutSvelte.getX(), LayoutSvelte.getY(), 5, 0, 2 * Math.PI);
                }
                ctx.stroke() // draw the line
            }
            ctx.restore()
        }
    })
}
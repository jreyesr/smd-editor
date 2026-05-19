import {Canvas, controlsUtils, FabricText, InteractiveFabricObject, PencilBrush} from "fabric";
import {components} from "./device";
import {SP1_50x50} from "./board";
import {collisionManager} from "./collisions";
import {Quadtree} from "@timohausmann/quadtree-ts";

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
    // isDrawingMode: true,
});
canvas.freeDrawingBrush = new PencilBrush(canvas)
if (canvas.freeDrawingBrush) {
    canvas.freeDrawingBrush.color = "blue"
    canvas.freeDrawingBrush.width = 12
}
canvas.on("path:created", function (e) {
    canvas.isDrawingMode = false
})
document.onkeydown = function (ev) {
    ev.preventDefault()
    console.log(ev.key, ev.shiftKey)
    const target = canvas.getActiveObject()
    const deltaAngle = ev.shiftKey ? -90 : 90
    const deltaMovement = ev.shiftKey ? 50 : 10
    if (!target) return

    switch (ev.key) {
        case "Delete":
        case "Backspace":
            canvas.remove(...canvas.getActiveObjects())
            canvas.discardActiveObject() // otherwise there's a ghost selection left if you delete a group of shapes
            break
        case "r":
        case "R":
            target.animate({
                angle: target.angle + deltaAngle
            }, {
                duration: 50,
                onChange: () => {
                    // HACKish: requestRenderAll marks for redraw since an object has changed, otherwise it doesn't rerender until something is dragged, see https://fabricjs.com/docs/old-docs/gotchas/#object-does-not-update-after-changing-property---objectcaching
                    // setCoords is because without it the corner controls (e.g. for rotation) stay behind (in their original positions) until the animation is completed, see https://stackoverflow.com/questions/52283622/fabricjs-rotate-object-without-moving-the-position#comment94141813_52683341
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
    target.fire("moving")
}

/*
const helloWorld = new FabricText('Hello\nworld!');
canvas.add(helloWorld);
canvas.centerObject(helloWorld);
helloWorld.on("moving", function (this: FabricText) {
    console.log(this.getX(), this.getY())
})*/

const ui = document.getElementById('ui')!
for (let deviceKind of components) {
    const btn = document.createElement("button")
    btn.textContent = "+ " + deviceKind.displayName
    btn.onclick = (e) => {
        const newDevice = new deviceKind.constructor(...(deviceKind.params || []))
        canvas.add(newDevice)
        canvas.centerObject(newDevice)
        newDevice.fire("moving") // to prod the collision detector
    }
    ui.appendChild(btn)
}

canvas.add(new SP1_50x50())
canvas.on("object:moving", function (ev) {
    ev.target.fire("moving", ev)
})


let DEBUG_QUADTREE = false
document.getElementById("debugQuadtree")!.onchange = function (ev) {
    // debugger
    DEBUG_QUADTREE = (ev.target as HTMLInputElement).checked
    canvas.requestRenderAll()
}
canvas.on("after:render", function ({ctx}) {
    if (!DEBUG_QUADTREE) return
    const colorNode = 'rgba(255,0,0,0.5)';

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
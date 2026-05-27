import {Canvas, Path} from "fabric";
import {components} from "./device";
import {addDeviceToCanvas, onSolderAdded} from "./main";

const contextMenu = document.getElementById("contextMenu")!

export function loadMenuOptions(canvas: Canvas) {
    canvas.on("contextmenu", (event) => {
        event.e.preventDefault()

        contextMenu.showPopover()
        contextMenu.style.top = (event.e as MouseEvent).clientY + "px"
        contextMenu.style.left = (event.e as MouseEvent).clientX + "px"
    })

    for (let deviceKind of components) {
        const btn = document.createElement("button")
        btn.textContent = "+ " + deviceKind.displayName
        btn.classList.add("option")

        btn.addEventListener("click", (ev) => {
            contextMenu.hidePopover()

            const newDevice = new deviceKind.constructor(...(deviceKind.params || []))
            addDeviceToCanvas(newDevice)
            // if possible, add the new device to where the click happened, but don't add it outside the visible
            const clickedPointClamped = canvas.getViewportPoint(ev).min({x: canvas.width, y: canvas.height})
            newDevice.setXY(clickedPointClamped)
            newDevice.setCoords();
            canvas.requestRenderAll();

            newDevice.fire("moving") // recompute collisions
        })

        contextMenu.appendChild(btn)
    }

    // solder lines button
    const solderBtn = document.createElement("button")
    solderBtn.textContent = "Solder"
    solderBtn.classList.add("option")
    solderBtn.addEventListener("click", () => {
        canvas.isDrawingMode = true
        contextMenu.hidePopover()

        canvas.once("path:created", (ev) => {
            onSolderAdded(ev.path as Path)
            canvas.isDrawingMode = false

        })
    })
    contextMenu.appendChild(solderBtn)

}


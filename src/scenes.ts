import {Color, Engine, GraphicsComponent, Scene, SceneActivationContext, TransformComponent, Vector} from "excalibur";
import {Device, mil} from "./device";
import {SP1_50x50} from "./board";
import {ElectricalComponent, ElectricalSystem} from "./components/electrical";
import {SolderLine} from "./solder";
import {UndoRedoSystem} from "./components/undoredo";

const ui = document.getElementById('ui')!
const pane = document.getElementById("controls")!

export class BoardEditorScene extends Scene {
    override onInitialize(engine: Engine): void {
        engine.backgroundColor = Color.White

        this.world.add(ElectricalSystem)
        this.world.add(UndoRedoSystem)

        this.add(new SP1_50x50());
    }

    override onActivate(context: SceneActivationContext<unknown>): void {
        for (let deviceClass of Device.derived) {
            const btn = document.createElement("button")
            btn.textContent = "+ " + deviceClass.displayName
            btn.onclick = (e) => {
                const newDevice = new deviceClass({x: 100 * mil, y: 100 * mil})
                newDevice.paneContainer = pane
                this.add(newDevice)
                newDevice.select(Vector.Zero) // start following cursor
            }
            ui.appendChild(btn)
        }

        // solder lines button
        const solderBtn = document.createElement("button")
        solderBtn.textContent = "Solder"
        solderBtn.onclick = (e) => {
            solderBtn.disabled = true
            const sl = new SolderLine()
            sl.once("done", () => {
                solderBtn.disabled = false
            })
            this.add(sl)
        }
        ui.appendChild(solderBtn)

        const saveBtn = document.createElement("button")
        saveBtn.textContent = "Save"
        saveBtn.onclick = (e) => {
            const x = this.world.query([ElectricalComponent, TransformComponent, GraphicsComponent])
            console.log(x.getEntities().filter(x => x.get(ElectricalComponent).serialize).map(x => {
                const tc = x.get(TransformComponent)
                return {
                    type: this.constructor.name,
                    pos: {x: tc.pos.x, y: tc.pos.y},
                    rotation: tc.rotation
                }
            }))
        }
        ui.appendChild(saveBtn)
    }
}
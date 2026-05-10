import {Actor, Component, Keys, Query, Scene, System, SystemType, World} from "excalibur";

export class UndoRedoComponent extends Component {

}

type Action = {
    type: "add" | "remove"
    target: any
}

export class UndoRedoSystem extends System {
    public systemType = SystemType.Update

    query: Query<typeof UndoRedoComponent>;
    #actionStack: Action[] = []
    #lastActionHandled?: Action

    constructor(world: World) {
        super();
        this.query = world.query([UndoRedoComponent])

        this.query.entityAdded$.subscribe((e) => {
            const comp = e.get(UndoRedoComponent)

            if (this.#lastActionHandled?.type !== "remove" || this.#lastActionHandled.target != comp.owner) {
                console.debug("NEW UNDOABLE", "add", comp.owner)
                this.#actionStack.push({type: "add", target: comp.owner})
            }

            comp.owner?.on("kill", ev => {
                if (this.#lastActionHandled?.type !== "add" || this.#lastActionHandled.target != comp.owner) {
                    console.debug("NEW UNDOABLE", "remove", comp.owner)
                    this.#actionStack.push({type: "remove", target: comp.owner})
                }
            })
        })
    }

    #scene?: Scene

    initialize(world: World, scene: Scene) {
        this.#scene = scene
    }

    update(elapsed: number) {
        if (this.#scene?.engine.input.keyboard.wasPressed(Keys.Z) && (this.#scene?.engine.input.keyboard.isHeld(Keys.ControlLeft) || this.#scene?.engine.input.keyboard.isHeld(Keys.ControlRight))) {
            const lastAction = this.#actionStack.pop()
            this.#lastActionHandled = lastAction

            console.log("UNDOING", lastAction)
            switch (lastAction?.type) {
                case "add":
                    (lastAction.target as Actor).kill()
                    break
                case "remove":
                    this.#scene!.add(lastAction.target)
                    break
            }
        }
    }
}
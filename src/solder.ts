import {
    Actor,
    ActorArgs,
    Circle,
    CircleCollider,
    CollisionType,
    Color,
    CompositeCollider,
    Engine,
    GraphicsGroup,
    GraphicsGrouping,
    PointerEvent,
    Vector
} from "excalibur";
import {ElectricalComponent} from "./components/electrical";
import {pinsCollisionGroup} from "./board";
import {mil} from "./device";
import {UndoRedoComponent} from "./components/undoredo";

// import {ElectricalComponent} from "./components/electrical";

const solderThickness = 10 * mil;

export class SolderLine extends Actor {
    #graphics = new GraphicsGroup({members: [] as GraphicsGrouping[], useAnchor: false})

    constructor(args: ActorArgs = {}) {
        super({
            collisionType: CollisionType.Passive,
            collisionGroup: pinsCollisionGroup,
            name: "Solder",
            ...args
        });
        this.graphics.add(this.#graphics)

        this.addComponent(new ElectricalComponent())
        this.addComponent(new UndoRedoComponent())
    }

    regenCollider() {
        this.collider.set(new CompositeCollider((this.#graphics.members as GraphicsGrouping[]).map(x => {
            const shape = (x.graphic as Circle)
            return new CircleCollider({
                radius: shape.radius,
                offset: x.offset.add(new Vector(solderThickness, solderThickness))
            })
        })))
    }

    onInitialize(engine: Engine) {
        super.onInitialize(engine);

        // just created, so hook up the drag events
        engine.input.pointers.primary.once("down", (ev) => {
            const handler = (ev: PointerEvent) => {
                this.#graphics.members.push({
                    graphic: new Circle({
                        radius: solderThickness,
                        color: Color.Blue,
                    }),
                    offset: ev.worldPos.sub(new Vector(solderThickness, solderThickness))
                })
                this.regenCollider()
            }
            engine.input.pointers.primary.on("move", handler)

            engine.input.pointers.primary.once("up", () => {
                this.emit("done")
                engine.input.pointers.primary.off("move", handler)
            })
        })
    }
}
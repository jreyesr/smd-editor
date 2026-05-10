import {
    Actor, ActorArgs, Circle, CircleCollider,
    CollisionGroup,
    CollisionType, Color, Rectangle
} from "excalibur";
import {mil} from "./device";
import {ElectricalComponent} from "./components/electrical";

export const pinsCollisionGroup = new CollisionGroup('electrical', 2, 2)

export class SP1_50x50 extends Actor {
    private numPadsX = 20;
    private numPadsY = 20;

    constructor() {
        super({
            name: "SP1 50x50 board",
        });
    }

    onInitialize() {
        Array(this.numPadsX).fill(0).forEach((_, i) => Array(this.numPadsY).fill(0).forEach((_, j) => {
            this.addChild(new SP1BoardPad({x: 50 * mil * i + 25 * mil, y: 50 * mil * j + 25 * mil}))
        }))
    }
}

class SP1BoardPad extends Actor {
    readonly #outline;

    constructor(config: ActorArgs = {}) {
        super({
            name: "SP1 50x50 pad",
            collisionType: CollisionType.Passive,
            collisionGroup: pinsCollisionGroup,
            // @ts-expect-error
            width: 42 * mil, height: 42 * mil,
            z: -1,
            ...config
        });

        this.#outline = new Rectangle({
            width: 42 * mil,
            height: 42 * mil,
            strokeColor: Color.Orange,
            lineWidth: 2,
            color: Color.White
        })
        this.graphics.use(this.#outline)
        this.addComponent(new ElectricalComponent(false, (newVals) => {
            this.#outline.color = newVals.size > 0 ? Color.Orange : Color.White
        }))
    }
}

export class ThrougHoleProtoboard extends Actor {
    private numPadsX = 20;
    private numPadsY = 14;

    constructor() {
        super({
            name: "100mil protoboard",
        });
    }

    onInitialize() {
        Array(this.numPadsX).fill(0).forEach((_, i) => Array(this.numPadsY).fill(0).forEach((_, j) => {
            this.addChild(new ThrougHoleBoardPad({x: 100 * mil * i + 50 * mil, y: 100 * mil * j + 50 * mil}))
        }))
    }
}

class ThrougHoleBoardPad extends Actor {
    readonly #outline;

    constructor(config: ActorArgs = {}) {
        super({
            name: "Through-hole pad",
            collisionType: CollisionType.Passive,
            collisionGroup: pinsCollisionGroup,
            // radius: 25 * mil,
            // color: Color.Orange,
            z: -1,
            ...config
        });
        this.collider.set(new CircleCollider({
            radius: 40 * mil
        }))

        this.#outline = new Circle({
            radius: 40 * mil,
            strokeColor: Color.Orange,
            lineWidth: 2,
            color: Color.White
        })
        this.graphics.use(this.#outline)
        this.addComponent(new ElectricalComponent(false, (newVals) => {
            this.#outline.color = newVals.size > 0 ? Color.Orange : Color.White
        }))
    }
}
import {
    Actor,
    ActorArgs, Circle,
    CircleOptions,
    CollisionType,
    Color,
    Engine,
    Line,
    Rectangle,
    RectangleOptions,
    Vector
} from "excalibur";
import {pinsCollisionGroup} from "./board";
import {ElectricalComponent} from "./components/electrical";

export class VerticalLinePad extends Actor {
    constructor(private size: number, config?: ActorArgs) {
        super({
            name: "pad-verticalline",
            collisionType: CollisionType.Passive,
            collisionGroup: pinsCollisionGroup,
            // @ts-expect-error
            width: 2, height: size,
            z: 1,
            ...config
        });

        this.addComponent(new ElectricalComponent(false))
    }

    onInitialize(engine: Engine) {
        super.onInitialize(engine);

        this.graphics.add(new Line({
            start: Vector.Zero,
            end: new Vector(0, this.size),
            color: Color.Green,
            thickness: 2,
        }))
    }
}

export class RectangularPad extends Actor {
    constructor(private size: RectangleOptions, config?: ActorArgs) {
        super({
            name: "pad-rectangle",
            collisionType: CollisionType.Passive,
            collisionGroup: pinsCollisionGroup,
            // @ts-expect-error
            width: size.width, height: size.height,
            z: 1,
            ...config
        });

        this.addComponent(new ElectricalComponent(false))
    }

    onInitialize(engine: Engine) {
        super.onInitialize(engine);

        this.graphics.add(new Rectangle({
            ...this.size,
            color: Color.Green,
        }))
    }
}

export class CircularPad extends Actor {
    constructor(private size: CircleOptions, config?: ActorArgs) {
        // @ts-ignore
        super({
            name: "pad-circle",
            collisionType: CollisionType.Passive,
            collisionGroup: pinsCollisionGroup,
            radius: size.radius,
            z: 1,
            ...config
        });

        this.addComponent(new ElectricalComponent(false))
    }

    onInitialize(engine: Engine) {
        super.onInitialize(engine);

        this.graphics.add(new Circle({
            ...this.size,
            color: Color.Green,
        }))
    }
}
import {Group, Rect} from "fabric";
import {mil} from "./device";
import {collisionManager} from "./collisions";

export class SP1_50x50 extends Group {
    private static numPadsX = 25;
    private static numPadsY = 18;

    constructor() {
        const pads = Array(SP1_50x50.numPadsX).fill(0).flatMap((_, i) =>
            Array(SP1_50x50.numPadsY).fill(0).map((_, j) =>
                new SP1BoardPad(50 * mil * i + 25 * mil, 50 * mil * j + 25 * mil)
            )
        )
        super(pads, {
            selectable: false,
            // originX: "left", originY: "top",
            // top: 0, left: 0
        });
    }
}

class SP1BoardPad extends Rect {
    constructor(x: number, y: number) {
        super({
            width: 42 * mil, height: 42 * mil,
            top: y, left: x,
            fill: "white",
            stroke: "orange",
            // originX: "left", originY: "top"
        });

        collisionManager.addElement(this)

        this.on("collision:update", function (this: SP1BoardPad, ev) {
            this.set("fill", ev.nowHitting.size > 0 ? "orange" : "white")
        })
    }
}
import {Circle, classRegistry, Group, Rect} from "fabric";
import {mil} from "./device";
import {collisionManager} from "./collisions";

export class SP1_50x50 extends Group {
    private static numPadsX = 25;
    private static numPadsY = 18;
    static type = 'Board/SP1_50x50'

    constructor() {
        const pads = Array(SP1_50x50.numPadsX).fill(0).flatMap((_, i) =>
            Array(SP1_50x50.numPadsY).fill(0).map((_, j) =>
                new SP1BoardPad(50 * mil * i + 25 * mil, 50 * mil * j + 25 * mil)
            )
        )
        const vias = Array(SP1_50x50.numPadsX).fill(0).flatMap((_, i) =>
            Array(SP1_50x50.numPadsY).fill(0)
                .map((_, j) => {
                        if ((i % 4 === 1) && (j % 4 === 1)) {
                            return new Circle({
                                radius: 12 * mil,
                                left: 50 * mil * i + 25 * mil, top: 50 * mil * j + 25 * mil,
                                stroke: "orange", fill: "white"
                            })
                        } else {
                            return undefined
                        }
                    }
                ).filter(x => x !== undefined)
        )
        super([...pads, ...vias], {
            selectable: false,
            // originX: "left", originY: "top",
            // top: 0, left: 0
        });
    }
}

classRegistry.setClass(SP1_50x50)

class SP1BoardPad extends Rect {
    static type = "Board/SP1_50x50/Pad"

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

classRegistry.setClass(SP1BoardPad)
import {Circle, classRegistry, Group, Rect} from "fabric";
import {mil} from "./device";
import {collisionManager} from "./collisions";
import {type FolderApi} from "tweakpane";


export class SP1_50x50 extends Group {
    static type = 'Board/SP1_50x50'

    // private setPads() {
    //     const padsAndVias = SP1_50x50.generatePads(this.numPadsX, this.numPadsY)
    //     this.removeAll()
    //     this.add(...padsAndVias)
    // }

    private static generatePads(numPadsX: number, numPadsY: number) {
        const pads = Array(numPadsX).fill(0).flatMap((_, i) =>
            Array(numPadsY).fill(0).map((_, j) =>
                new SP1BoardPad(50 * mil * i + 25 * mil, 50 * mil * j + 25 * mil)
            )
        )
        const vias = Array(numPadsX).fill(0).flatMap((_, i) =>
            Array(numPadsY).fill(0)
                .map((_, j) => {
                        if ((i % 4 === 1) && (j % 4 === 1)) {
                            return new Circle({
                                radius: 12 * mil,
                                left: 50 * mil * i + 25 * mil, top: 50 * mil * j + 25 * mil,
                                stroke: "orange", fill: "white", strokeWidth: 2,
                            })
                        } else {
                            return undefined
                        }
                    }
                ).filter(x => x !== undefined)
        )
        return [...pads, ...vias]
    }

    constructor(public numPadsX = 25, public numPadsY = 18) {
        const padsAndVias = SP1_50x50.generatePads(numPadsX, numPadsY)
        super(padsAndVias, {
            selectable: false,
        });
    }

    setupParametersPane(pane: FolderApi): void {
        // pane.addBinding(this, "numPadsX", {
        //     min: 5,
        //     max: 100,
        //     step: 1,
        // }).on("change", ev => {
        //     this.setPads()
        //     this.canvas?.requestRenderAll()
        // })
    }
}

classRegistry.setClass(SP1_50x50)

class SP1BoardPad extends Rect {
    static type = "Board/SP1_50x50/Pad"

    constructor(x: number, y: number) {
        super({
            width: 42 * mil, height: 42 * mil,
            top: y, left: x,
            fill: "white", stroke: "orange", strokeWidth: 2
        });

        collisionManager.addElement(this)

        this.on("collision:update", function (this: SP1BoardPad, ev) {
            this.set("fill", ev.nowHitting.size > 0 ? "orange" : "white")
        })
    }
}

export class ThroughHoleProtoboard extends Group {
    static type = 'Board/ThroughHole';

    private static generatePads(numPadsX: number, numPadsY: number) {
        const pads = Array(numPadsX).fill(0).flatMap((_, i) =>
            Array(numPadsY).fill(0).map((_, j) =>
                new ThroughHoleBoardPad(100 * mil * i + 50 * mil, 100 * mil * j + 50 * mil)
            )
        )
        const vias = Array(numPadsX).fill(0).flatMap((_, i) =>
            Array(numPadsY).fill(0).map((_, j) =>
                new Circle({
                    radius: 12 * mil,
                    top: 100 * mil * j + 50 * mil, left: 100 * mil * i + 50 * mil,
                    fill: "white", stroke: "orange", strokeWidth: 2,
                })
            )
        )
        return [...pads, ...vias]
    }

    // private setPads() {
    //     const padsAndVias = ThroughHoleProtoboard.generatePads(this.numPadsX, this.numPadsY)
    //     this.removeAll()
    //     this.add(...padsAndVias)
    // }

    constructor(public numPadsX = 20, public numPadsY = 14) {
        const padsAndVias = ThroughHoleProtoboard.generatePads(numPadsX, numPadsY)
        super(padsAndVias, {
            selectable: false,
        });
    }

    setupParametersPane(pane: FolderApi): void {
        // pane.addBinding(this, "numPadsX", {
        //     min: 5
        // }).on("change", ev => {
        //     this.setPads()
        // })
    }
}

classRegistry.setClass(ThroughHoleProtoboard)

class ThroughHoleBoardPad extends Circle {
    static type = "Board/ThroughHole/Pad"

    constructor(x: number, y: number) {
        super({
            radius: 40 * mil,
            top: y, left: x,
            fill: "white", stroke: "orange", strokeWidth: 2,
        });

        collisionManager.addElement(this)

        this.on("collision:update", function (this: ThroughHoleBoardPad, ev) {
            this.set("fill", ev.nowHitting.size > 0 ? "orange" : "white")
        })
    }
}

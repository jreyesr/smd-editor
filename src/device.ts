import {Group, FabricObject, Rect, Circle, FabricObjectProps, FabricText} from "fabric";
import {collisionManager} from "./collisions";
import {Pane} from "tweakpane";

const PIXELS_PER_MM = 40;
export const mm = PIXELS_PER_MM;
export const inch = PIXELS_PER_MM * 25.4;
export const mil = inch / 1000;

export const components: {
    displayName: string,
    constructor: new (...args: any[]) => Device,
    params?: any[]
}[] = []

class RectangularPad extends Rect {
    constructor(width: number, height: number, posX: number, posY: number) {
        super({
            width, height,
            fill: "green",
            left: posX, top: posY
        });
        collisionManager.addElement(this)
    }
}

export abstract class Device extends Group {
    protected constructor(protected graphical: FabricObject[],
                          protected pins: RectangularPad[],
                          props?: Partial<FabricObjectProps>) {
        super([], {
            padding: 5,
            ...props,
        })
        this.add(...this.graphical, ...this.pins)

        this.on("moving", function (this: Device, ev) {
            this.pins.forEach(p => p.fire("moving", ev))
        })
        this.once("removed", function (this: Device, ev) {
            this.pins.forEach(p => p.fire("removed", ev))
        })
    }

    setupParametersPane(pane: Pane) {
    }
}

export class SHT40 extends Device {
    static {
        components.push({
            displayName: "SHT40",
            constructor: SHT40,
            params: []
        })
    }

    constructor(props?: Partial<FabricObjectProps>) {
        super(
            [
                new Rect({width: 1.5 * mm, height: 1.5 * mm, stroke: "black", strokeWidth: 1, fill: "white"}),
                new Circle({radius: .3 * mm, stroke: "black", fill: "transparent"}),
                new FabricText("SH40", {
                    top: -.5 * mm, left: 0, fontSize: 13
                })
            ],
            [
                new RectangularPad(.3 * mm, .3 * mm, -.75 * mm + .15 * mm, -.4 * mm),
                new RectangularPad(.3 * mm, .3 * mm, -.75 * mm + .15 * mm, .4 * mm),
                new RectangularPad(.3 * mm, .3 * mm, .75 * mm - .15 * mm, .4 * mm),
                new RectangularPad(.3 * mm, .3 * mm, .75 * mm - .15 * mm, -.4 * mm),
            ],
            props
        );
    }
}

export class Passive extends Device {
    static {
        components.push(
            {
                displayName: "0402",
                constructor: Passive,
                params: [40 * mil, 20 * mil, "0402"]
            },
            {
                displayName: "0603",
                constructor: Passive,
                params: [60 * mil, 30 * mil, "0603"]
            },
            {
                displayName: "0805",
                constructor: Passive,
                params: [80 * mil, 50 * mil, "0805"]
            },
            {
                displayName: "1206",
                constructor: Passive,
                params: [120 * mil, 60 * mil, "1206"]
            },
        )
    }

    #label: FabricText

    constructor(width: number, height: number, tag: string, props?: Partial<FabricObjectProps>) {
        const padWidth = .15 * width // arbitrary, but matches https://www.farnell.com/datasheets/15586.pdf really well, and it looks good, so...

        const label = new FabricText(tag, {
            left: 0, top: 0, height,
            // magically works very well, https://fabricjs.com/demos/text-on-path/ has a 2.5 factor but that one is way too large
            fontSize: width / tag.length
        })
        super(
            [
                new Rect({width, height, stroke: "black", strokeWidth: 1, fill: "white"}),
                label,
            ],
            [
                new RectangularPad(padWidth, height, (width / 2 - padWidth / 2) * -1, 0),
                new RectangularPad(padWidth, height, width / 2 - padWidth / 2, 0),
            ],
            props
        );

        this.#label = label
    }

    setupParametersPane(pane: Pane) {
        pane.addBinding(this.#label, "text", {label: "tag"});
        // const _params = {cathodeMark: false}
        // pane.addBinding(_params, "cathodeMark").on("change", (e) => this.cathodeMark.color = e.value ? Color.Black : Color.Transparent
        // )
    }
}

export class SOIC extends Device {
    static {
        components.push(
            {
                displayName: "SOIC8",
                constructor: SOIC,
                params: [4.9 * mm, 8, "SOIC8"]
            },
            {
                displayName: "SOIC14",
                constructor: SOIC,
                params: [8.69 * mm, 14, "SOIC14"]
            },
            {
                displayName: "SOIC16",
                constructor: SOIC,
                params: [9.91 * mm, 16, "SOIC16"]
            },
        )
    }

    constructor(height: number, numPins: number, tag: string, props?: Partial<FabricObjectProps>) {
        const pin1X = -(6.02 * mm / 2 - 0.62 * mm / 2) // pin 1's X is always -(E/2 - L/2)
        const numGapsBetweenPins = numPins / 2 - 1 // e.g. for SOIC8, there are 3 gaps between pins (per side)
        const pin1Y = -(numGapsBetweenPins / 2 * 1.27 * mm) // e.g. for SOIC8 the 1st pin is 1.5 gaps above center
        const pins = Array(numPins).fill(0).map((_, i) => {
            const isLeftSide = i < numPins / 2 // e.g. for SOIC8: true, true, true, true, false, false, false, false
            const yIndex = isLeftSide ? i : numPins - i - 1 // e.g. for SOIC8: 0, 1, 2, 3, 3, 2, 1, 0ç

            return new RectangularPad(.62 * mm, .42 * mm,
                pin1X * (isLeftSide ? 1 : -1),
                pin1Y + 1.27 * mm * yIndex,)
        })

        super(
            [
                new Rect({width: 3.91 * mm, height, stroke: "black", strokeWidth: 1, fill: "white"}),
                new FabricText(tag, {
                    left: 0, top: 0, height
                }),
                new Circle({
                    radius: .3 * mm,
                    left: -1.2 * mm, // center offset .75mm from edge
                    top: -height / 2 + .75 * mm,
                    stroke: "black",
                    strokeWidth: 1,
                    fill: "white"
                })
            ],
            pins
        )
    }
}
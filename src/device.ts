import {Group, FabricObject, Rect, Circle, FabricObjectProps, FabricText, classRegistry} from "fabric";
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
    static type = "Device/RectangularPad"

    constructor(width: number, height: number, posX: number, posY: number) {
        super({
            width, height,
            fill: "green",
            left: posX, top: posY
        });
        collisionManager.addElement(this)
    }
}

classRegistry.setClass(RectangularPad)

export type SerializedExtraData = Record<string, any>
export type SerializedDevice = {
    type: string
    x: number
    y: number
    rotation: number,
    extraData: SerializedExtraData
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

    setupParametersPane(pane: Pane): void {
    }

    save(): SerializedExtraData {
        return {}
    };

    static load(serialized: SerializedExtraData): Device {
        throw new Error("unimplemented")
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
    static type = "Device/SHT40"

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

    static override load(serialized: SerializedExtraData): Device {
        return new SHT40()
    }
}

classRegistry.setClass(SHT40)


type PassiveSerializedData = {
    width: number
    height: number
    tag: string
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
    static type = "Device/Passive2Pin"

    #label: FabricText

    constructor(private bodyWidth: number, private bodyHeight: number, private tag: string, props?: Partial<FabricObjectProps>) {
        const padWidth = .15 * bodyWidth // arbitrary, but matches https://www.farnell.com/datasheets/15586.pdf really well, and it looks good, so...

        const label = new FabricText(tag, {
            left: 0, top: 0, height: bodyHeight,
            // width/length in chars magically works very well, https://fabricjs.com/demos/text-on-path/ has a 2.5 factor but that one is way too large
            fontSize: bodyWidth / tag.length
        })
        super(
            [
                new Rect({width: bodyWidth, height: bodyHeight, stroke: "black", strokeWidth: 1, fill: "white"}),
                label,
            ],
            [
                new RectangularPad(padWidth, bodyHeight, (bodyWidth / 2 - padWidth / 2) * -1, 0),
                new RectangularPad(padWidth, bodyHeight, bodyWidth / 2 - padWidth / 2, 0),
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

    override save(): PassiveSerializedData {
        return {
            width: this.bodyWidth, height: this.bodyHeight, tag: this.tag
        };
    }

    static override load(serialized: PassiveSerializedData): Device {
        return new Passive(serialized.width, serialized.height, serialized.tag)
    }
}

classRegistry.setClass(Passive)

type SOICSerializedData = {
    height: number
    tag: string
    numPins: number
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
    static type = "Device/SOIC"

    constructor(private bodyHeight: number, private numPins: number, private tag: string, props?: Partial<FabricObjectProps>) {
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
                new Rect({width: 3.91 * mm, height: bodyHeight, stroke: "black", strokeWidth: 1, fill: "white"}),
                new FabricText(tag, {
                    left: 0, top: 0, height: bodyHeight
                }),
                new Circle({
                    radius: .3 * mm,
                    left: -1.2 * mm, // center offset .75mm from edge
                    top: -bodyHeight / 2 + .75 * mm,
                    stroke: "black",
                    strokeWidth: 1,
                    fill: "white"
                })
            ],
            pins
        )
    }

    override save(): SOICSerializedData {
        return {
            height: this.bodyHeight, tag: this.tag, numPins: this.numPins,
        };
    }

    static override load(serialized: SOICSerializedData): Device {
        return new SOIC(serialized.height, serialized.numPins, serialized.tag)
    }
}

classRegistry.setClass(SOIC)


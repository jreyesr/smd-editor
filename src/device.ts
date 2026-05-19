import {Group, FabricObject, Rect, Circle, FabricObjectProps, FabricText} from "fabric";
import {collisionManager} from "./collisions";

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
        // this.on("moving", function (this: Device, ev) {
        //     const hits = collisionManager.findHits(this)
        //     this.set("fill", hits.length > 0 ? "red" : "green")
        // })
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
                    top: -.5*mm, left: 0, fontSize: 13
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

    constructor(width: number, height: number, tag: string, props?: Partial<FabricObjectProps>) {
        const padWidth = .15 * width // arbitrary, but matches https://www.farnell.com/datasheets/15586.pdf really well, and it looks good, so...

        super(
            [
                new Rect({width, height, stroke: "black", strokeWidth: 1, fill: "white"}),
                new FabricText(tag, {
                    left: 0, top: 0, height,
                    // magically works very well, https://fabricjs.com/demos/text-on-path/ has a 2.5 factor but that one is way too large
                    fontSize: width / tag.length
                })
            ],
            [
                new RectangularPad(padWidth, height, (width / 2 - padWidth / 2) * -1, 0),
                new RectangularPad(padWidth, height, width / 2 - padWidth / 2, 0),
            ],
            props
        );
    }
}

import {Group, FabricObject, Rect, Circle, FabricObjectProps, FabricText, classRegistry, util} from "fabric";
import {collisionManager} from "./collisions";
import {ListBladeApi, Pane, TextBladeApi} from "tweakpane";
import {ButtonGridApi} from "@tweakpane/plugin-essentials";

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

class CircularPad extends Circle {
    static type = "Device/CircularPad"

    constructor(radius: number, posX: number, posY: number) {
        super({
            radius,
            fill: "green",
            left: posX, top: posY
        });
        collisionManager.addElement(this)
    }
}

classRegistry.setClass(CircularPad)


export type SerializedExtraData = Record<string, any>
export type SerializedDevice = {
    type: string
    x: number
    y: number
    rotation: number,
    extraData: SerializedExtraData
}

export abstract class Device extends Group {
    private movingDisposer?: VoidFunction;
    private removedDisposer?: VoidFunction;

    protected setElements() {
        for (let pin of this.pins) {
            // HACK this shouldn't be necessary (Group.add -> Collection.add -> Group._onObjectAdded -> Group.enterGroup -> Group._enterGroup is supposed to do the same thing)
            // but if we don't do this then changing pins on a Device that already exists places them way too top&left
            // (probably because from the Pin's POV its coordinates are close to 0)
            // NOTE this has to be done *before* the .add call below, otherwise it doesn't apply correctly
            util.sendObjectToPlane(pin, undefined, util.invertTransform(this.calcTransformMatrix()))
        }

        this.removeAll()
        this.add(...this.graphical, ...this.pins)

        this.movingDisposer?.()
        this.movingDisposer = this.on("moving", function (this: Device, ev) {
            this.pins.forEach(p => p.fire("moving", ev))
        })

        this.removedDisposer?.()
        this.removedDisposer = this.once("removed", function (this: Device, ev) {
            this.pins.forEach(p => p.fire("removed", ev))
        })
    }

    protected constructor(protected graphical: FabricObject[],
                          protected pins: RectangularPad[] | CircularPad[],
                          props?: Partial<FabricObjectProps>) {
        super([], {
            padding: 5,
            ...props,
        })

        this.setElements()
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
                displayName: "0402 passive",
                constructor: Passive,
                params: [40 * mil, 20 * mil, "0402"]
            },
            {
                displayName: "0603 passive",
                constructor: Passive,
                params: [60 * mil, 30 * mil, "0603"]
            },
            {
                displayName: "0805 passive",
                constructor: Passive,
                params: [80 * mil, 50 * mil, "0805"]
            },
            {
                displayName: "1206 passive",
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
        (pane.addBlade({
            view: "text",
            label: "tag",
            parse: String,
            value: this.#label.text
        }) as TextBladeApi<string>).on("change", (ev) => {
            this.#label.set("text", ev.value)
            this.canvas?.requestRenderAll()
        });
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
    missingPinNumbers: number[]
}

export class SOIC extends Device {
    private static readonly STANDARD_DIMENSIONS: Record<number, number> = {
        8: 4.9 * mm,
        14: 8.7 * mm,
        16: 9.9 * mm
    }
    static {
        components.push(
            {
                displayName: "SOIC8",
                constructor: SOIC,
                params: [SOIC.STANDARD_DIMENSIONS[8], 8, "SOIC8"]
            },
            {
                displayName: "SOIC14",
                constructor: SOIC,
                params: [SOIC.STANDARD_DIMENSIONS[14], 14, "SOIC14"]
            },
            {
                displayName: "SOIC16",
                constructor: SOIC,
                params: [SOIC.STANDARD_DIMENSIONS[16], 16, "SOIC16"]
            },
        )
    }
    static type = "Device/SOIC"
    #label: FabricText

    /**
     * Creates the RectangularPads for this device's pins
     * @param numPins e.g. 8 or 14, the number of pins in this device, must be even
     * @param missingPinNumbers optional, a set of pin numbers to NOT create, e.g. [7] on a SOIC14 won't create the bottom left pin that is commonly GND on 7400-series logic devices
     * @private
     */
    private static makePins(numPins: number, missingPinNumbers = new Set<number>()) {
        const pin1X = -(6.02 * mm / 2 - 0.62 * mm / 2) // pin 1's X is always -(E/2 - L/2)
        const numGapsBetweenPins = numPins / 2 - 1 // e.g. for SOIC8, there are 3 gaps between pins (per side)
        const pin1Y = -(numGapsBetweenPins / 2 * 1.27 * mm) // e.g. for SOIC8 the 1st pin is 1.5 gaps above center

        return Array(numPins).fill(0).map((_, i) => {
            const pinNumber = i + 1 // pin 1 is top left, pin <numPins + 1> is top right
            if (missingPinNumbers.has(pinNumber)) return // jump over this one

            const isLeftSide = i < numPins / 2 // e.g. for SOIC8: true, true, true, true, false, false, false, false
            const yIndex = isLeftSide ? i : numPins - i - 1 // e.g. for SOIC8: 0, 1, 2, 3, 3, 2, 1, 0ç

            return new RectangularPad(.62 * mm, .42 * mm,
                pin1X * (isLeftSide ? 1 : -1),
                pin1Y + 1.27 * mm * yIndex,
            )
        }).filter(p => p !== undefined)
    }

    private missingPinNumbers = new Set<number>()

    constructor(private bodyHeight: number, private numPins: number, private tag: string, props?: Partial<FabricObjectProps>) {
        const pins = SOIC.makePins(numPins)

        const label = new FabricText(tag, {
            left: 0, top: 0, height: bodyHeight
        })
        super(
            [
                new Rect({width: 3.91 * mm, height: bodyHeight, stroke: "black", strokeWidth: 1, fill: "white"}),
                label,
                new Circle({
                    radius: .3 * mm,
                    left: -1.2 * mm, // center offset .75mm from edge
                    top: -bodyHeight / 2 + .75 * mm,
                    stroke: "black",
                    strokeWidth: 1,
                    fill: "white"
                })
            ],
            pins,
            props,
        )
        this.#label = label
    }

    override setupParametersPane(pane: Pane) {
        // @ts-expect-error doesn't recognize "tag" as keyof this
        pane.addBinding(this, "tag").on("change", () => {
            this.#label.set("text", this.tag)
            this.canvas?.requestRenderAll()
        });

        ((pane.addBlade({
            view: "list",
            label: "size",
            options: Object.keys(SOIC.STANDARD_DIMENSIONS).map(numPins => ({
                text: `${numPins} pins narrow`,
                value: parseInt(numPins)
            })),
            value: this.numPins,
        })) as ListBladeApi<number>).on("change", ev => {
            this.numPins = ev.value
            this.pins = SOIC.makePins(ev.value, this.missingPinNumbers)
            this.setElements()
            this.canvas?.requestRenderAll()
        });

        (pane.addBlade({
            view: "buttongrid", size: [2, this.numPins / 2],
            cells: (x: number, y: number) => ({
                title: `${"LR"[x]}${y + 1}`,
            }),
            label: "pins"
        }) as ButtonGridApi).on("click", (ev) => {
            // e.g. if (0, 2) on 8-pin then pinNumber = 3, if (1, 3) then pinNumber = 5
            const pinNumber = ev.index[0] === 0 // is left side?
                ? ev.index[1] + 1 // then just the idx[1] + 1 because Tweakpane nums are 0-based but IC pins are 1-based
                : this.numPins - ev.index[1] // else it's right side -> add numPins/2 and numbering is in reverse (bottom up)

            if (this.missingPinNumbers.has(pinNumber)) {
                this.missingPinNumbers.delete(pinNumber)
                ev.cell.title = `✓ ${"LR"[ev.index[0]]}${ev.index[1] + 1}`
            } else {
                this.missingPinNumbers.add(pinNumber)
                ev.cell.title = `× ${"LR"[ev.index[0]]}${ev.index[1] + 1}`
            }

            this.pins = SOIC.makePins(this.numPins, this.missingPinNumbers)
            this.setElements()
            this.canvas?.requestRenderAll()
        });
    }

    override save(): SOICSerializedData {
        return {
            height: this.bodyHeight, tag: this.tag,
            numPins: this.numPins, missingPinNumbers: Array.from(this.missingPinNumbers)
        };
    }

    static override load(serialized: SOICSerializedData): SOIC {
        const dev = new SOIC(serialized.height, serialized.numPins, serialized.tag)
        dev.missingPinNumbers = new Set<number>(serialized.missingPinNumbers ?? [])
        dev.pins = SOIC.makePins(dev.numPins, dev.missingPinNumbers)
        dev.setElements()
        return dev
    }
}

classRegistry.setClass(SOIC)

type DIPSerializedData = {
    height: number
    tag: string
    numPins: number
    missingPinNumbers: number[]
}

export class DIP extends Device {
    // https://ww1.microchip.com/downloads/en/PackagingSpec/00049w.pdf
    private static readonly STANDARD_DIMENSIONS: Record<number, number> = {
        8: 9.46 * mm,
        14: 19.05 * mm,
        16: 19.05 * mm
    }
    static {
        components.push(
            {
                displayName: "DIP8",
                constructor: DIP,
                params: [DIP.STANDARD_DIMENSIONS[8], 8, "DIP8"]
            },
            {
                displayName: "DIP14",
                constructor: DIP,
                params: [DIP.STANDARD_DIMENSIONS[14], 14, "DIP14"]
            },
            {
                displayName: "DIP16",
                constructor: DIP,
                params: [DIP.STANDARD_DIMENSIONS[16], 16, "DIP16"]
            },
        )
    }
    static type = "Device/DIP"
    #label: FabricText

    /**
     * Creates the RectangularPads for this device's pins
     * @param numPins e.g. 8 or 14, the number of pins in this device, must be even
     * @param missingPinNumbers optional, a set of pin numbers to NOT create, e.g. [7] on a SOIC14 won't create the bottom left pin that is commonly GND on 7400-series logic devices
     * @private
     */
    private static makePins(numPins: number, missingPinNumbers = new Set<number>()) {
        const pin1X = -(150 * mil) // the rows of pins are separated 300 mils so left row is 150mils to the left of center
        const numGapsBetweenPins = numPins / 2 - 1 // e.g. for DIP8, there are 3 gaps between pins (per side)
        const pin1Y = -(numGapsBetweenPins / 2 * 100 * mil) // e.g. for DIP8 the 1st pin is 1.5 gaps above center

        return Array(numPins).fill(0).map((_, i) => {
            const pinNumber = i + 1 // pin 1 is top left, pin <numPins + 1> is top right
            if (missingPinNumbers.has(pinNumber)) return // jump over this one

            const isLeftSide = i < numPins / 2 // e.g. for DIP4: true, true, false, false
            const yIndex = isLeftSide ? i : numPins - i - 1 // e.g. for DIP4: 0, 1, 1, 0

            // radius should be about B/2 in https://ww1.microchip.com/downloads/en/PackagingSpec/00049w.pdf
            return new CircularPad(.46 * mm / 2,
                pin1X * (isLeftSide ? 1 : -1),
                pin1Y + 100 * mil * yIndex,
            )
        }).filter(p => p !== undefined)
    }

    private missingPinNumbers = new Set<number>()

    constructor(private bodyHeight: number, private numPins: number, private tag: string, props?: Partial<FabricObjectProps>) {
        const pins = DIP.makePins(numPins)

        const label = new FabricText(tag, {
            left: 0, top: 0, height: bodyHeight
        })
        super(
            [
                // width = E1
                new Rect({width: 250 * mil, height: bodyHeight, stroke: "black", strokeWidth: 1, fill: "white"}),
                label,
                new Circle({
                    radius: .3 * mm,
                    left: -250 * mil / 2 + .75 * mm, // center offset .75mm from edge
                    top: -bodyHeight / 2 + .75 * mm,
                    stroke: "black",
                    strokeWidth: 1,
                    fill: "white"
                })
            ],
            pins,
            props
        )
        this.#label = label
    }

    override setupParametersPane(pane: Pane) {
        // @ts-expect-error doesn't recognize "tag" as keyof this
        pane.addBinding(this, "tag").on("change", () => {
            this.#label.set("text", this.tag)
            this.canvas?.requestRenderAll()
        });

        ((pane.addBlade({
            view: "list",
            label: "size",
            options: Object.keys(DIP.STANDARD_DIMENSIONS).map(numPins => ({
                text: `${numPins} pins narrow`,
                value: parseInt(numPins)
            })),
            value: this.numPins,
        })) as ListBladeApi<number>).on("change", ev => {
            this.numPins = ev.value
            this.pins = DIP.makePins(ev.value, this.missingPinNumbers)
            this.setElements()
            this.canvas?.requestRenderAll()
        });

        (pane.addBlade({
            view: "buttongrid", size: [2, this.numPins / 2],
            cells: (x: number, y: number) => ({
                title: `${"LR"[x]}${y + 1}`,
            }),
            label: "pins"
        }) as ButtonGridApi).on("click", (ev) => {
            // e.g. if (0, 2) on 8-pin then pinNumber = 3, if (1, 3) then pinNumber = 5
            const pinNumber = ev.index[0] === 0 // is left side?
                ? ev.index[1] + 1 // then just the idx[1] + 1 because Tweakpane nums are 0-based but IC pins are 1-based
                : this.numPins - ev.index[1] // else it's right side -> add numPins/2 and numbering is in reverse (bottom up)

            if (this.missingPinNumbers.has(pinNumber)) {
                this.missingPinNumbers.delete(pinNumber)
                ev.cell.title = `✓ ${"LR"[ev.index[0]]}${ev.index[1] + 1}`
            } else {
                this.missingPinNumbers.add(pinNumber)
                ev.cell.title = `× ${"LR"[ev.index[0]]}${ev.index[1] + 1}`
            }

            this.pins = DIP.makePins(this.numPins, this.missingPinNumbers)
            this.setElements()
            this.canvas?.requestRenderAll()
        });
    }

    override save(): DIPSerializedData {
        return {
            height: this.bodyHeight, tag: this.tag,
            numPins: this.numPins, missingPinNumbers: Array.from(this.missingPinNumbers)
        };
    }

    static override load(serialized: DIPSerializedData): Device {
        const dev = new DIP(serialized.height, serialized.numPins, serialized.tag)
        dev.missingPinNumbers = new Set<number>(serialized.missingPinNumbers ?? [])
        dev.pins = DIP.makePins(dev.numPins, dev.missingPinNumbers)
        dev.setElements()
        return dev
    }
}

classRegistry.setClass(DIP)

type SOT23SerializedData = {
    tag: string
    missingPinNumbers: number[]
}

export class SOT23 extends Device {
    private static MISSING_PIN_PRESETS = {3: [2, 4, 6], 5: [5], 6: []}
    static {
        components.push(
            {
                displayName: "SOT23-3",
                constructor: SOT23,
                params: ["SOT23-3", new Set(SOT23.MISSING_PIN_PRESETS["3"])]
            },
            {
                displayName: "SOT23-5",
                constructor: SOT23,
                params: ["SOT23-5", new Set(SOT23.MISSING_PIN_PRESETS["5"])]
            },
            {
                displayName: "SOT23-6",
                constructor: SOT23,
                params: ["SOT23-6", new Set(SOT23.MISSING_PIN_PRESETS["6"])]
            },
        )
    }
    static type = "Device/SOT23"
    #label: FabricText

    /**
     * Creates the RectangularPads for this device's pins
     * @param missingPinNumbers optional, a set of pin numbers to NOT create, e.g. [2, 4, 6] is the SOT23-3 package with 2 pins on the left and 1 pin on the right, staggered
     * @private
     */
    private static makePins(missingPinNumbers = new Set<number>()) {
        // https://ww1.microchip.com/downloads/en/PackagingSpec/00049w.pdf
        const pin1X = -(2.8 * mm / 2 - .45 * mm / 2) // -(E/2 - L/2)
        const pin1Y = -(.95 * mm) // pin pitch for all SOT-23 variants is .95mm nominal, ignoring pins that are separated 2 spaces

        return Array(6).fill(0).map((_, i) => {
            const pinNumber = i + 1 // pin 1 is top left, pin <numPins + 1> is top right
            if (missingPinNumbers.has(pinNumber)) return // jump over this one

            const isLeftSide = pinNumber <= 3 // we ignore possibly missing pins e.g. SOT23-3 will only have pins 1, 3, 5, 1 and 3 are on left side
            const yIndex = isLeftSide ? i : 5 - i // e.g. for SOT23-3: 0, 1 (but skipped), 2, 2 (skipped), 1, 0 (skipped)

            // make the patch LxB centered on
            return new RectangularPad(
                .45 * mm, .44 * mm,
                pin1X * (isLeftSide ? 1 : -1),
                pin1Y + .95 * mm * yIndex,
            )
        }).filter(p => p !== undefined)
    }

    constructor(private tag: string, private missingPinNumbers: Set<number>, props?: Partial<FabricObjectProps>) {
        const pins = SOT23.makePins(missingPinNumbers)

        const label = new FabricText(tag, {
            left: 0, top: 0, height: 2.95 * mm,
            fontSize: 1.63 * mm / tag.length * 1.5
        })
        super(
            [
                // width = E1
                new Rect({width: 1.63 * mm, height: 2.95 * mm, stroke: "black", strokeWidth: 1, fill: "white"}),
                label,
                new Circle({
                    radius: .12 * mm,
                    left: -1.63 * mm / 2 + .4 * mm, // center offset .. from edge
                    top: -2.95 * mm / 2 + .4 * mm,
                    stroke: "black",
                    strokeWidth: 1,
                    fill: "black"
                })
            ],
            pins,
            props
        )
        this.#label = label
    }

    override setupParametersPane(pane: Pane) {
        // @ts-expect-error doesn't recognize "tag" as keyof this
        pane.addBinding(this, "tag").on("change", () => {
            this.#label.set("text", this.tag)
            this.canvas?.requestRenderAll()
        });


        let buttonGridBlade: ButtonGridApi
        const currentPreset = this.missingPinNumbers.symmetricDifference(new Set([2, 4, 6])).size == 0 ? 3
            : this.missingPinNumbers.symmetricDifference(new Set([5])).size == 0 ? 5
                : this.missingPinNumbers.size == 0 ? 6
                    : 0;
        ((pane.addBlade({
            view: "list",
            label: "pkg",
            options: [
                {text: "SOT23-3", value: 3},
                {text: "SOT23-5", value: 5},
                {text: "SOT23-6", value: 6},
                {text: "other", value: 0},
            ],
            value: currentPreset,
        })) as ListBladeApi<number>).on("change", ev => {
            if (ev.value !== 0) { // not the "other" option
                buttonGridBlade.disabled = true
                this.missingPinNumbers = new Set((SOT23.MISSING_PIN_PRESETS as Record<string, number[]>)[ev.value.toString()])
                this.pins = SOT23.makePins(this.missingPinNumbers)
                this.setElements()
                this.canvas?.requestRenderAll()
            } else { // the "other option", enable the button grid for manual pin choosage
                buttonGridBlade.disabled = false
            }
        });

        buttonGridBlade = pane.addBlade({
            view: "buttongrid", size: [2, 3],
            cells: (x: number, y: number) => ({
                title: `${"LR"[x]}${y + 1}`,
            }),
            label: "pins"
        }) as ButtonGridApi
        if (currentPreset !== 0) {
            buttonGridBlade.disabled = true
        }
        buttonGridBlade.on("click", (ev) => {
            // e.g. if (0, 2) on 8-pin then pinNumber = 3, if (1, 3) then pinNumber = 5
            const pinNumber = ev.index[0] === 0 // is left side?
                ? ev.index[1] + 1 // then just the idx[1] + 1 because Tweakpane nums are 0-based but IC pins are 1-based
                : 6 - ev.index[1] // else it's right side -> e.g. (2, 0) is right up -> pin 6

            if (this.missingPinNumbers.has(pinNumber)) {
                this.missingPinNumbers.delete(pinNumber)
                ev.cell.title = `✓ ${"LR"[ev.index[0]]}${ev.index[1] + 1}`
            } else {
                this.missingPinNumbers.add(pinNumber)
                ev.cell.title = `× ${"LR"[ev.index[0]]}${ev.index[1] + 1}`
            }

            this.pins = SOT23.makePins(this.missingPinNumbers)
            this.setElements()
            this.canvas?.requestRenderAll()
        });
    }

    override save(): SOT23SerializedData {
        return {
            tag: this.tag,
            missingPinNumbers: Array.from(this.missingPinNumbers)
        };
    }

    // static override load(serialized: DIPSerializedData): Device {
    //     const dev = new DIP(serialized.height, serialized.numPins, serialized.tag)
    //     dev.missingPinNumbers = new Set<number>(serialized.missingPinNumbers ?? [])
    //     dev.pins = DIP.makePins(dev.numPins, dev.missingPinNumbers)
    //     dev.setElements()
    //     return dev
    // }
}

classRegistry.setClass(DIP)


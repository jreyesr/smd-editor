import {
    Actor,
    ActorArgs,
    assert,
    Circle,
    CollisionGroup,
    CollisionType,
    Color,
    Engine, Font,
    Graphic,
    GraphicsGroup,
    GraphicsGrouping,
    Keys,
    PointerButton,
    PointerEvent,
    Raster,
    Rectangle,
    Text,
    RotationType,
    Shape,
    Vector
} from "excalibur";
import {CircularPad, RectangularPad, VerticalLinePad} from "./pads";
import {ElectricalComponent} from "./components/electrical";
import {Pane} from "tweakpane";
import {UndoRedoComponent} from "./components/undoredo";

const PIXELS_PER_MM = 30;
export const mm = PIXELS_PER_MM;
export const inch = PIXELS_PER_MM * 25.4;
export const mil = inch / 1000;

export const devicesCollisionGroup = new CollisionGroup('physical', 1, 1)

export class Device extends Actor {
    protected readonly outline: Raster

    #paneContainer?: HTMLElement
    set paneContainer(v: HTMLElement | undefined) {
        this.#paneContainer = v
    }

    #pane?: Pane

    setupParametersPane(pane: Pane) {
    }

    #nowSelected: "left" | "right" | false = false

    #onMoveCurrentHandler?: (pe: PointerEvent) => void = undefined

    private _onMove(pe: PointerEvent, offsetInBody: Vector) {
        this.pos = pe.worldPos.sub(offsetInBody)
    }

    select(offset: Vector) {
        this.#nowSelected = "left"
        this.outline.strokeColor = Color.Blue
        this.outline.lineWidth = 5

        this.actions.scaleTo(new Vector(1.05, 1.05), new Vector(1, 1))
        // start following the mouse cursor with this Actor
        this.#onMoveCurrentHandler = (pe) => this._onMove(pe, offset)
        this.scene?.engine.input.pointers.primary.on("move", this.#onMoveCurrentHandler)
    }

    unselect() {
        this.#nowSelected = false
        this.outline.strokeColor = Color.Black
        this.outline.lineWidth = 2
        this.actions.scaleTo(Vector.One, new Vector(1, 1))

        // stop following cursor
        this.scene?.engine.input.pointers.primary.off("move", this.#onMoveCurrentHandler!)
        this.#onMoveCurrentHandler = undefined
    }

    toggleSelect(offset: Vector) {
        if (this.#nowSelected) this.unselect()
        else this.select(offset)
    }

    toggleParams() {
        if (this.#pane) { // dismiss it
            this.#nowSelected = false
            this.#pane.dispose()
            this.#pane = undefined
            this.outline.strokeColor = Color.Black
            this.outline.lineWidth = 2
        } else { // display it
            this.#nowSelected = "right"
            if (this.#paneContainer) {
                this.#pane = new Pane({container: this.#paneContainer})
                this.setupParametersPane(this.#pane)
                this.outline.strokeColor = Color.Azure
                this.outline.lineWidth = 5
            }
        }
    }

    constructor(args: ActorArgs = {}, private extraGraphics: (Graphic | GraphicsGrouping)[] = []) {
        super({
            collisionType: CollisionType.Passive,
            collisionGroup: devicesCollisionGroup,
            z: 1,
            ...args
        });

        this.outline = new Rectangle({
            width: this.width,
            height: this.height,
            color: Color.White,
            strokeColor: Color.Black,
            lineWidth: 2,
        })

        this.addComponent(new ElectricalComponent(true, (news) => {
            this.outline.color = news.size > 0 ? Color.Red : Color.White
        }))
        this.addComponent(new UndoRedoComponent())

        // this.draggable = true
        this.on("pointerdown", (ev) => {
            switch (ev.button) {
                case PointerButton.Left:
                    this.toggleSelect(ev.coordinates.worldPos.sub(this.localCenter))
                    break
                case PointerButton.Right:
                    this.toggleParams()
                    break
            }
        })
    }

    override onInitialize(engine: Engine) {
        super.onInitialize(engine);

        this.graphics.add(new GraphicsGroup({members: [this.outline, ...this.extraGraphics]}));
        this.graphics.recalculateBounds()
        this.collider.set(Shape.Box(this.width, this.height))
    }

    onPreUpdate(engine: Engine, elapsed: number): void {
        const speed = engine.input.keyboard.isHeld(Keys.ShiftRight) || engine.input.keyboard.isHeld(Keys.ShiftLeft) ? 200 : 20
        let tracked_velocity = Vector.Zero;
        if (engine.input.keyboard.isHeld(Keys.A)) {
            tracked_velocity.x = -speed;
        }
        if (engine.input.keyboard.isHeld(Keys.D)) {
            tracked_velocity.x = speed;
        }
        if (engine.input.keyboard.isHeld(Keys.W)) {
            tracked_velocity.y = -speed;
        }
        if (engine.input.keyboard.isHeld(Keys.S)) {
            tracked_velocity.y = speed;
        }

        if (this.#nowSelected === "left") {
            this.vel = tracked_velocity;
        }
    }

    update(engine: Engine, elapsed: number) {
        super.update(engine, elapsed);
        if (this.#nowSelected === "left") { // only listen to keyboard events when this Device is selected
            const shiftPressed = engine.input.keyboard.isHeld(Keys.ShiftRight) || engine.input.keyboard.isHeld(Keys.ShiftLeft)

            switch (true) {
                case engine.input.keyboard.wasPressed(Keys.R):
                    this.actions.rotateBy({
                        angleRadiansOffset: Math.PI / 2 * (shiftPressed ? -1 : 1),
                        rotationType: RotationType.ShortestPath,
                        duration: 70
                    })
                    break
                case engine.input.keyboard.wasPressed(Keys.Delete) || engine.input.keyboard.wasPressed(Keys.Backspace):
                    this.kill()
                    break
                case engine.input.keyboard.wasPressed(Keys.Enter):
                    this.unselect()
                    break

            }
        }
    }

    static derived = new Set<typeof Device>()
}

export class SHT40 extends Device {
    static {
        this.derived.add(this)
    }

    constructor(config: ActorArgs = {}) {
        super({
                name: "SHT40",
                // @ts-expect-error
                width: 1.5 * mm, height: 1.5 * mm,
                ...config,
            },
            [{
                graphic: new Circle({
                    radius: .3 * mm,
                    color: Color.Transparent,
                    strokeColor: Color.Black,
                    lineWidth: 1
                }),
                offset: new Vector(.375 * mm, .375 * mm) // TODO why tho? should be .45 in theory...
            }, {
                graphic: new Text({text: "SHT40", font: new Font({size: 8})}),
                offset: new Vector(.3 * mm, .1 * mm)
            }]
        );
    }

    override onInitialize(engine: Engine) {
        super.onInitialize(engine);
        this.addChild(new RectangularPad({width: .3 * mm, height: .3 * mm}, {x: (-.75 + .15) * mm, y: -.4 * mm}))
        this.addChild(new RectangularPad({width: .3 * mm, height: .3 * mm}, {x: (.75 - .15) * mm, y: -.4 * mm}))
        this.addChild(new RectangularPad({width: .3 * mm, height: .3 * mm}, {x: (-.75 + .15) * mm, y: .4 * mm}))
        this.addChild(new RectangularPad({width: .3 * mm, height: .3 * mm}, {x: (.75 - .15) * mm, y: .4 * mm}))
    }
}

export class Passive extends Device {
    static {
        this.derived.add(class Passive0402 extends Passive {
            constructor(config: ActorArgs = {}) {
                super(.04 * inch, .02 * inch, config);
            }
        })
        this.derived.add(class Passive0603 extends Passive {
            constructor(config: ActorArgs = {}) {
                super(.06 * inch, .03 * inch, config);
            }
        })
        this.derived.add(class Passive0805 extends Passive {
            constructor(config: ActorArgs = {}) {
                super(.08 * inch, .05 * inch, config);
            }
        })
        this.derived.add(class Passive1206 extends Passive {
            constructor(config: ActorArgs = {}) {
                super(.12 * inch, .06 * inch, config);
            }
        })
    }

    private readonly label: Text

    constructor(w: number, h: number, config: ActorArgs = {}) {
        const label = new Text({text: "R?", font: new Font({size: 10}), maxWidth: w,})
        super({
            name: "SMD 2-pin device",
            // @ts-expect-error
            width: w, height: h,
            ...config
        }, [
            {
                graphic: label,
                offset: new Vector(w * 0.05, h * 0.05)
            }
        ]);
        this.label = label
    }

    override onInitialize(engine: Engine) {
        super.onInitialize(engine);
        this.addChild(new VerticalLinePad(this.height, {x: -this.width / 2}))
        this.addChild(new VerticalLinePad(this.height, {x: this.width / 2}))
    }

    override setupParametersPane(pane: Pane) {
        pane.addBinding(this.label, "text", {label: "tag"});
    }
}

export class SOIC extends Device {
    static {
        // https://ww1.microchip.com/downloads/en/packagingspec/00049af.pdf
        this.derived.add(class SOIC8 extends SOIC {
            constructor(config: ActorArgs = {}) {
                super({pinNames: ["1", "2", "3", "4", "5", "6", "7", "8"], bodySize: 4.9 * mm}, config);
            }
        })
        this.derived.add(class SOIC14 extends SOIC {
            constructor(config: ActorArgs = {}) {
                super({
                    pinNames: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"],
                    bodySize: 8.69 * mm
                }, config);
            }
        })
        this.derived.add(class SOIC16 extends SOIC {
            constructor(config: ActorArgs = {}) {
                super({
                    pinNames: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"],
                    bodySize: 9.91 * mm
                }, config);
            }
        })
    }
    private readonly label: Text

    constructor(protected args: { pinNames: string[], bodySize: number }, config: ActorArgs = {}) {
        const label = new Text({text: "IC?", font: new Font({size: 15}), maxWidth: 3.91 * mm})
        assert("should have an even number of pins", () => (args.pinNames.length % 2) === 0)
        super({
            name: `SOIC`,
            // @ts-expect-error
            width: 3.91 * mm, height: args.bodySize,
            ...config
        }, [
            {
                graphic: new Circle({
                    radius: .3 * mm,
                    color: Color.Transparent,
                    strokeColor: Color.Black,
                    lineWidth: 1
                }),
                offset: new Vector(.3 * mm, .3 * mm)
            },
            {
                graphic: label,
                offset: new Vector(1.2 * mm, args.bodySize * 0.05)
            }
        ]);

        this.label = label
    }

    override onInitialize(engine: Engine) {
        super.onInitialize(engine);

        // note that these aren't the soldering pad sizes, but a projection of the chip leads
        const pin1X = -(6.02 * mm / 2 - 0.62 * mm / 2) // pin 1's X is always -(E/2 - L/2)
        const numGapsBetweenPins = this.args.pinNames.length / 2 - 1 // e.g. for SOIC8, there are 3 gaps between pins (per side)
        const pin1Y = -(numGapsBetweenPins / 2 * 1.27 * mm) // e.g. for SOIC8 the 1st pin is 1.5 gaps above center
        for (let i = 0; i < this.args.pinNames.length; i++) {
            const isLeftSide = i < this.args.pinNames.length / 2 // e.g. for SOIC8: true, true, true, true, false, false, false, false
            const yIndex = isLeftSide ? i : this.args.pinNames.length - i - 1 // e.g. for SOIC8: 0, 1, 2, 3, 3, 2, 1, 0

            this.addChild(new RectangularPad({
                // L and B dimensions respectively
                width: .62 * mm, height: .42 * mm
            }, {
                x: pin1X * (isLeftSide ? -1 : 1),
                y: pin1Y + 1.27 * mm * yIndex
            }))
        }
    }

    override setupParametersPane(pane: Pane) {
        pane.addBinding(this.label, "text", {label: "tag"});
    }
}

export class DIP extends Device {
    static {
        // https://ww1.microchip.com/downloads/en/packagingspec/00049af.pdf
        this.derived.add(class DIP8 extends DIP {
            constructor(config: ActorArgs = {}) {
                super({pinNames: ["1", "2", "3", "4", "5", "6", "7", "8"], bodySize: 9.46 * mm}, config);
            }
        })
        // this.derived.add(class SOIC14 extends SOIC {
        //     constructor(config: ActorArgs = {}) {
        //         super({
        //             pinNames: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"],
        //             bodySize: 8.69 * mm
        //         }, config);
        //     }
        // })
        // this.derived.add(class SOIC16 extends SOIC {
        //     constructor(config: ActorArgs = {}) {
        //         super({
        //             pinNames: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"],
        //             bodySize: 9.91 * mm
        //         }, config);
        //     }
        // })
    }
    private readonly label: Text

    constructor(protected args: { pinNames: string[], bodySize: number }, config: ActorArgs = {}) {
        const label = new Text({text: "IC?", font: new Font({size: 25}), maxWidth: 6.2 * mm})
        assert("should have an even number of pins", () => (args.pinNames.length % 2) === 0)
        super({
            name: "DIP",
            // @ts-expect-error
            width: 6.35 * mm, height: args.bodySize,
            ...config
        }, [
            {
                graphic: new Circle({
                    radius: .6 * mm,
                    color: Color.Transparent,
                    strokeColor: Color.Black,
                    lineWidth: 1
                }),
                offset: new Vector(.6 * mm, .6 * mm)
            },
            {
                graphic: label,
                offset: new Vector(2.4 * mm, args.bodySize * 0.05)
            }
        ]);

        this.label = label
    }

    override onInitialize(engine: Engine) {
        super.onInitialize(engine);

        // note that these aren't the soldering pad sizes, but a projection of the chip leads
        const pin1X = -(300 * mil / 2) // pin 1's X is -(W/2)
        const numGapsBetweenPins = this.args.pinNames.length / 2 - 1 // e.g. for DIP8, there are 3 gaps between pins (per side)
        const pin1Y = -(numGapsBetweenPins / 2 * 100 * mil) // e.g. for DIP8 the 1st pin is 1.5 gaps above center
        for (let i = 0; i < this.args.pinNames.length; i++) {
            const isLeftSide = i < this.args.pinNames.length / 2 // e.g. for DIP8: true, true, true, true, false, false, false, false
            const yIndex = isLeftSide ? i : this.args.pinNames.length - i - 1 // e.g. for DIP8: 0, 1, 2, 3, 3, 2, 1, 0

            this.addChild(new CircularPad({
                // B dimension (Lower Lead Width)
                radius: .46 * mm
            }, {
                x: pin1X * (isLeftSide ? -1 : 1),
                y: pin1Y + 100 * mil * yIndex
            }))
        }
    }

    override setupParametersPane(pane: Pane) {
        pane.addBinding(this.label, "text", {label: "tag"});
    }
}

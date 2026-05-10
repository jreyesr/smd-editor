import {
    Actor,
    Collider, ColliderComponent,
    Component,
    Query,
    System,
    SystemType,
    World
} from "excalibur";

export class ElectricalComponent extends Component {
    constructor(public serialize: boolean = true, public onChanged?: (newVals: Set<Collider>) => void) {
        super()
    }

    public nowColliding: Set<Collider> = new Set()
}

export class ElectricalSystem extends System {
    public systemType = SystemType.Update

    query: Query<typeof ElectricalComponent | typeof ColliderComponent>;

    constructor(world: World) {
        super()
        this.query = world.query([ElectricalComponent, ColliderComponent]);

        this.query.entityAdded$.subscribe(e => {
            const comp = e.get(ElectricalComponent);
            (e as Actor).on("collisionstart", (ce) => {
                comp.nowColliding.add(ce.other)
                comp.onChanged?.(comp.nowColliding)
            });
            (e as Actor).on("collisionend", (ce) => {
                comp.nowColliding.delete(ce.other)
                comp.onChanged?.(comp.nowColliding)
            });
        })
    }

    update(elapsed: number) {
    }
}
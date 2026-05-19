import {Circle, FabricObject, TEvent} from "fabric";
import {Quadtree, Rectangle as QTRectangle, Circle as QTCircle} from "@timohausmann/quadtree-ts";

function fabricToQuadtree(f: FabricObject): QTRectangle<FabricObject> | QTCircle<FabricObject> {
    switch (true) {
        case f instanceof Circle:
            return new QTCircle({
                x: f.getX(), y: f.getY(),
                r: f.getRadiusX(), // assume the same as getRadiusY
                data: f
            })
        default:
            const bb = f.getBoundingRect()
            return new QTRectangle({
                x: bb.left, y: bb.top,
                width: bb.width, height: bb.height,
                data: f
            })
    }

}

function collides(a: QTRectangle<unknown> | QTCircle<unknown>, b: QTRectangle<unknown> | QTCircle<unknown>) {
    function overlap([a1, a2]: [number, number], [b1, b2]: [number, number]) {
        /* case 1, a1<b1: intersect
            a1-------------a2
                  b1---->
            OR no intersect
            a1-----a2
                       b1--->
           otherwise, a1>=b1: intersect
                a1--->
            b1---------b2
           OR no intersect
                     a1--->
            b1---b2
         */
        return (a1 <= b1 && b1 <= a2) || (a1 >= b1 && a1 <= b2)
    }

    switch (true) {
        case a instanceof QTCircle && b instanceof QTCircle:
            // dist between centers = sqrt(Δx^2 + Δy^2) <= r1+r2
            return Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) <= Math.pow(a.r + b.r, 2)
        case a instanceof QTRectangle && b instanceof QTRectangle:
            // simple AABB checks
            return overlap([a.x, a.x + a.width], [b.x, b.x + b.width]) &&
                overlap([a.y, a.y + a.height], [b.y, b.y + b.height])
        default:
            // either a is circle and b is rect or viceversa, quadtree-ts has a utility function for that
            const circle = a instanceof QTCircle ? a : b as QTCircle<unknown>
            const rect = a instanceof QTCircle ? b as QTRectangle<unknown> : a
            return QTCircle.intersectRect(circle.x, circle.y, circle.r, rect.x, rect.y, rect.x + rect.width, rect.y + rect.height)
    }
}

export const collisionManager = {
    lastHitStatuses: new WeakMap<FabricObject, Set<FabricObject>>(),
    _quadtree: new Quadtree<QTRectangle<FabricObject> | QTCircle<FabricObject>>({
        width: 1600, height: 750,
        // maxLevels: 0
    }),

    addElement(elem: FabricObject) {
        const quadtreeEntity = fabricToQuadtree(elem)
        this._quadtree.insert(quadtreeEntity)
        const that = this
        elem.on("moving", function () {
            quadtreeEntity.x = elem.getBoundingRect().left
            quadtreeEntity.y = elem.getBoundingRect().top
            // no need to change width and height, we never allow any elements to be change size
            that._quadtree.update(quadtreeEntity)
            that.findHits(elem)
        })
    },

    findHits(elem: FabricObject) {
        const quadtreeElem = fabricToQuadtree(elem)
        const hits = this._quadtree.retrieve(quadtreeElem)
            .filter(e => elem !== e.data && collides(quadtreeElem, e))
            .map(e => ({a: elem, b: e.data!}))
        // .filter(coll => {
        //     return coll.status === 'Intersection'
        //         || coll.status === "Coincident"
        //         || coll.a.isContainedWithinObject(coll.b)
        //         || coll.b.isContainedWithinObject(coll.a)
        // })

        const prevHits = this.lastHitStatuses.get(elem) ?? new Set()
        const currentHits = new Set(hits.map(h => h.b))
        this.lastHitStatuses.set(elem, currentHits)
        elem.fire("collision:update", {nowHitting: currentHits})

        const newHits = currentHits.difference(prevHits)
        for (let hitter of newHits) {
            elem.fire("collision:on", {other: hitter, nowHitting: currentHits})
            if (!this.lastHitStatuses.has(hitter)) this.lastHitStatuses.set(hitter, new Set())
            this.lastHitStatuses.get(hitter)!.add(elem)
            hitter.fire("collision:on", {
                other: elem,
                nowHitting: this.lastHitStatuses.get(hitter) ?? new Set<FabricObject>()
            })
            hitter.fire("collision:update", {nowHitting: this.lastHitStatuses.get(hitter) ?? new Set()})
        }

        const noLongerHits = prevHits.difference(currentHits)
        for (let formerHitter of noLongerHits) {
            elem.fire("collision:off", {other: formerHitter, nowHitting: currentHits})
            if (!this.lastHitStatuses.has(formerHitter)) this.lastHitStatuses.set(formerHitter, new Set())
            this.lastHitStatuses.get(formerHitter)!.delete(elem)
            formerHitter.fire("collision:off", {
                other: elem,
                nowHitting: this.lastHitStatuses.get(formerHitter) ?? new Set<FabricObject>()
            })
            formerHitter.fire("collision:update", {nowHitting: this.lastHitStatuses.get(formerHitter) ?? new Set()})
        }

        return hits
    }
}

declare module "fabric" {
    interface ObjectEvents {
        "collision:on": Partial<TEvent> & {
            other: FabricObject,
            nowHitting: Set<FabricObject>
            // collInfo?: ReturnType<typeof Intersection.intersectPolygonPolygon>
        }
        "collision:off": Partial<TEvent> & {
            other: FabricObject,
            nowHitting: Set<FabricObject>
            // collInfo?: ReturnType<typeof Intersection.intersectPolygonPolygon>
        },
        "collision:update": Partial<TEvent> & {
            nowHitting: Set<FabricObject>
        }
    }
}
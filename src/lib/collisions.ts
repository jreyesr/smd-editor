import {Circle, FabricObject, Path, type TEvent, util} from "fabric";
import {Quadtree, Rectangle as QTRectangle, Circle as QTCircle, type RectangleProps} from "@timohausmann/quadtree-ts";
import {solderRadius} from "$lib/solder";

function fabricToQuadtree(f: FabricObject): QTShapes<FabricObject> {
    switch (true) {
        case f instanceof Circle:
            return new QTCircle({
                x: f.getX(), y: f.getY(),
                r: f.getRadiusX(), // assume the same as getRadiusY
                data: f
            })
        case f instanceof Path:
            const bbPath = f.getBoundingRect()
            return new QTBezier({
                x: bbPath.left, y: bbPath.top,
                width: bbPath.width, height: bbPath.height,
                data: f
            }, solderRadius)
        default:
            const bbRect = f.getBoundingRect()
            return new QTRectangle({
                x: bbRect.left, y: bbRect.top,
                width: bbRect.width, height: bbRect.height,
                data: f
            })
    }

}

function collides(a: QTShapes<unknown>, b: QTShapes<unknown>) {
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
        case (a instanceof QTBezier && b instanceof QTRectangle) || (b instanceof QTBezier && a instanceof QTRectangle):
            // curve-to-rect coll check (e.g solderline to rectangular SMD board pad or to rectangular device pin)
            const rect = (a instanceof QTBezier ? b : a) as QTRectangle<FabricObject>
            const bezierBezierRect = (a instanceof QTBezier ? a : b) as QTBezier
            return bezierBezierRect.intersectsRect(rect)
        case (a instanceof QTBezier && b instanceof QTCircle) || (b instanceof QTBezier && a instanceof QTCircle):
            // curve-to-rect coll check (e.g solderline to through-hole board pad)
            const circleBezierCircle = (a instanceof QTBezier ? b : a) as QTCircle<FabricObject>
            const bezierBezierCircle = (a instanceof QTBezier ? a : b) as QTBezier
            return bezierBezierCircle.intersectsCircle(circleBezierCircle)
        case a instanceof QTRectangle && b instanceof QTRectangle:
            // simple AABB checks
            return overlap([a.x, a.x + a.width], [b.x, b.x + b.width]) &&
                overlap([a.y, a.y + a.height], [b.y, b.y + b.height])
        default:
            // either a is circle and b is rect or viceversa, quadtree-ts has a utility function for that
            const circleDef = a instanceof QTCircle ? a : b as QTCircle<unknown>
            const rectDef = a instanceof QTCircle ? b as QTRectangle<unknown> : a
            return QTCircle.intersectRect(circleDef.x, circleDef.y, circleDef.r, rectDef.x, rectDef.y, rectDef.x + rectDef.width, rectDef.y + rectDef.height)
    }
}

class QTBezier extends QTRectangle<Path> {
    // just a placeholder so we can do x instanceof QTBezier.
    // the quadtree uses the bounding box for coarse collision culling, then the actual collision check uses the Bezier's
    // control points (not the paths themselves!), assuming they'll be quite close because they come from a mouse drag which
    // takes points ~ every frame

    constructor(props: RectangleProps<Path>, private pathRadius: number) {
        super(props);
    }

    intersectsRect(rect: QTRectangle<unknown>) {
        const bezierOff = this.data!.pathOffset!
        const pointHitsRect = ({x, y}: { x: number, y: number }) => {
            const pointRealX = x - bezierOff.x + this.x + this.width / 2
            const pointRealY = y - bezierOff.y + this.y + this.height / 2
            return QTCircle.intersectRect(pointRealX, pointRealY, this.pathRadius, rect.x, rect.y, rect.x + rect.width, rect.y + rect.height)
        }
        return util.getPathSegmentsInfo(this.data!.path).some(pointHitsRect)
    }

    intersectsCircle(circle: QTCircle<unknown>) {
        const bezierOff = this.data!.pathOffset!
        const pointHitsCircle = ({x, y}: { x: number, y: number }) => {
            const pointRealX = x - bezierOff.x + this.x + this.width / 2
            const pointRealY = y - bezierOff.y + this.y + this.height / 2
            // hit if the distance between (centerpoint of path point) and (centerpoint of circle under test) is <= (sum of both circles' radiuses)
            // not using sqrt under the assumption that √(Δx²+Δy²)<(r1+r2) is slower than Δx²+Δy²<(r1+r2)²
            // also: Δx = x_circle - x_point (or viceversa, it doesn't matter because it's squared anyway)
            return Math.pow(circle.x - pointRealX, 2) + Math.pow(circle.y - pointRealY, 2) <= Math.pow(this.pathRadius + circle.r, 2)
        }
        return util.getPathSegmentsInfo(this.data!.path).some(pointHitsCircle)
    }
}

type QTShapes<T> = QTRectangle<T> | QTCircle<T> | QTBezier

export const collisionManager = {
    _lastHitStatuses: new Map<FabricObject, Set<FabricObject>>(),
    _fabricToQTMap: new Map<FabricObject, QTShapes<FabricObject>>(),
    _quadtree: new Quadtree<QTShapes<FabricObject>>({
        width: 1600, height: 750,
        // maxLevels: 0
    }),

    addElement(elem: FabricObject) {
        const quadtreeEntity = fabricToQuadtree(elem)
        this._quadtree.insert(quadtreeEntity)
        this._fabricToQTMap.set(elem, quadtreeEntity)

        const that = this

        function updatePositionInQuadtree() {
            quadtreeEntity.x = elem.getBoundingRect().left
            quadtreeEntity.y = elem.getBoundingRect().top
            // no need to change width and height, we never allow any elements to be change size
            that._quadtree.update(quadtreeEntity)
            that.findHits(elem)
        }

        elem.on("moving", updatePositionInQuadtree)
        elem.on("added", updatePositionInQuadtree) // e.g. when added to group, then the coords will change

        elem.once("removed", function () {
            collisionManager.removeElement(elem)
        })
    },

    removeElement(elem: FabricObject) {
        const quadtreeEntity = this._fabricToQTMap.get(elem)
        if (!quadtreeEntity) return
        this._quadtree.remove(quadtreeEntity)

        // inform everyone that was being hit by the delete object
        const wasHitting = this._lastHitStatuses.get(elem) ?? new Set()
        for (let hitter of wasHitting) {
            this._lastHitStatuses.get(hitter)?.delete(elem)
            hitter.fire("collision:off", {
                other: elem,
                nowHitting: this._lastHitStatuses.get(hitter) ?? new Set<FabricObject>()
            })
            hitter.fire("collision:update", {nowHitting: this._lastHitStatuses.get(hitter) ?? new Set()})
        }
    },

    findHits(elem: FabricObject) {
        const quadtreeElem = fabricToQuadtree(elem)
        const hits = this._quadtree.retrieve(quadtreeElem) // coarse collision check via basic shapes
            .filter(e => elem !== e.data && collides(quadtreeElem, e)) // actual collision check (e.g. using the real bezier's path instead of its bounding box)
            .map(e => ({a: elem, b: e.data!}))

        const prevHits = this._lastHitStatuses.get(elem) ?? new Set()
        const currentHits = new Set(hits.map(h => h.b))
        this._lastHitStatuses.set(elem, currentHits)
        elem.fire("collision:update", {nowHitting: currentHits})

        const newHits = currentHits.difference(prevHits)
        for (let hitter of newHits) {
            elem.fire("collision:on", {other: hitter, nowHitting: currentHits})
            if (!this._lastHitStatuses.has(hitter)) this._lastHitStatuses.set(hitter, new Set())
            this._lastHitStatuses.get(hitter)!.add(elem)
            hitter.fire("collision:on", {
                other: elem,
                nowHitting: this._lastHitStatuses.get(hitter) ?? new Set<FabricObject>()
            })
            hitter.fire("collision:update", {nowHitting: this._lastHitStatuses.get(hitter) ?? new Set()})
        }

        const noLongerHits = prevHits.difference(currentHits)
        for (let formerHitter of noLongerHits) {
            elem.fire("collision:off", {other: formerHitter, nowHitting: currentHits})
            if (!this._lastHitStatuses.has(formerHitter)) this._lastHitStatuses.set(formerHitter, new Set())
            this._lastHitStatuses.get(formerHitter)!.delete(elem)
            formerHitter.fire("collision:off", {
                other: elem,
                nowHitting: this._lastHitStatuses.get(formerHitter) ?? new Set<FabricObject>()
            })
            formerHitter.fire("collision:update", {nowHitting: this._lastHitStatuses.get(formerHitter) ?? new Set()})
        }

        return hits
    },

    /**
     * Given the latest collision statuses (A collides with B and D, B collides with A, ...),
     * returns a set of connected components, i.e. all the groups of things that collide with
     * each other and with nothing else, possibly indirectly.
     * E.g. if pin A collides with board pad 1,2 and solder line X collides with board pads 1,2
     * and 1,3 and pin A of another device collides with board pad 1,3, then all of them are part of the same connected
     * component (pin A->pad 1,2->solder line->pad 1,2->pin A')
     */
    getConnectedSets(): Set<Set<FabricObject>> {
        const dfs = (elem: FabricObject, alreadyKnown: Set<FabricObject>) => {
            const adjacent = this._lastHitStatuses.get(elem)
            if (adjacent === undefined) return // elem doesn't connect to anything
            const newlyKnown = adjacent.difference(alreadyKnown) // this is to prevent cycles
            for (let x of newlyKnown) {
                alreadyKnown.add(x)
                dfs(x, alreadyKnown)
            }
            // no need to return anything, alreadyKnown is changed in-place
        }

        const components = new Set<Set<FabricObject>>()
        let alreadyCovered = new Set<FabricObject>()
        for (let seedElem of this._lastHitStatuses.keys()) {
            if (alreadyCovered.has(seedElem)) continue

            const singleComponent = new Set<FabricObject>()
            singleComponent.add(seedElem)
            dfs(seedElem, singleComponent) // will alter connectedElems
            alreadyCovered = alreadyCovered.union(singleComponent) // e.g. if {A, B}, then there's no need to then start from seed B

            components.add(singleComponent)
        }

        return components
    },
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
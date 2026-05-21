import {Circle, FabricObject, Path, TEvent, util} from "fabric";
import {Quadtree, Rectangle as QTRectangle, Circle as QTCircle, RectangleProps} from "@timohausmann/quadtree-ts";
import {solderRadius} from "./main";

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
            // curve-to-rect coll check
            const rect = (a instanceof QTBezier ? b : a) as QTRectangle<FabricObject>
            const bezier = (a instanceof QTBezier ? a : b) as QTBezier
            return bezier.intersectsRect(rect)
        case a instanceof QTRectangle && b instanceof QTRectangle:
            // simple AABB checks
            return overlap([a.x, a.x + a.width], [b.x, b.x + b.width]) &&
                overlap([a.y, a.y + a.height], [b.y, b.y + b.height])
        default:
            // either a is circle and b is rect or viceversa, quadtree-ts has a utility function for that
            const circle = a instanceof QTCircle ? a : b as QTCircle<unknown>
            const rectDef = a instanceof QTCircle ? b as QTRectangle<unknown> : a
            return QTCircle.intersectRect(circle.x, circle.y, circle.r, rectDef.x, rectDef.y, rectDef.x + rectDef.width, rectDef.y + rectDef.height)
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
}

type QTShapes<T> = QTRectangle<T> | QTCircle<T> | QTBezier

export const collisionManager = {
    _lastHitStatuses: new WeakMap<FabricObject, Set<FabricObject>>(),
    _fabricToQTMap: new WeakMap<FabricObject, QTShapes<FabricObject>>(),
    _quadtree: new Quadtree<QTShapes<FabricObject>>({
        width: 1600, height: 750,
        // maxLevels: 0
    }),

    addElement(elem: FabricObject) {
        const quadtreeEntity = fabricToQuadtree(elem)
        this._quadtree.insert(quadtreeEntity)
        this._fabricToQTMap.set(elem, quadtreeEntity)

        const that = this
        elem.on("moving", function () {
            quadtreeEntity.x = elem.getBoundingRect().left
            quadtreeEntity.y = elem.getBoundingRect().top
            // no need to change width and height, we never allow any elements to be change size
            that._quadtree.update(quadtreeEntity)
            that.findHits(elem)
        })

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
        const hits = this._quadtree.retrieve(quadtreeElem)
            .filter(e => elem !== e.data && collides(quadtreeElem, e))
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
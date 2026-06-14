import type {Canvas, FabricObject} from "fabric";
import type {Quadtree} from "@timohausmann/quadtree-ts";
import {collisionManager} from "./collisions";
import {type FolderApi} from "tweakpane";
import {type FpsGraphBladeApi} from "@tweakpane/plugin-essentials";

export type DebugOptions = {
    enableQuadtree: boolean
    enableRatsnest: boolean
    enableCollisions: boolean
}

export function setupDebugViews(canvas: Canvas, options: DebugOptions) {
    return canvas.on("after:render", function ({ctx}) {
        if (options.enableQuadtree) {
            const colorNode = 'rgba(255,0,0,0.5)';

            /* this comes from https://github.com/timohausmann/quadtree-ts/blob/4ab917a58cd7b7c7e7289c4dc0bc3ee2e2c9ee3e/docs/examples/assets/examples.js#L8
            * Copyright (c) 2012-2023 Timo Hausmann */
            function drawQuadtree(node: Quadtree<any>, ctx: CanvasRenderingContext2D, index: number[]) {
                //no subnodes? draw the current node
                if (node.nodes.length === 0) {
                    ctx.strokeStyle = colorNode;
                    ctx.strokeRect(node.bounds.x, node.bounds.y, node.bounds.width, node.bounds.height);
                    ctx.strokeText(index.join(""), node.bounds.x + 2, node.bounds.y + 10 /* default font is 10px */, node.bounds.width);

                    //has subnodes? drawQuadtree them!
                } else {
                    for (let i = 0; i < node.nodes.length; i = i + 1) {
                        drawQuadtree(node.nodes[i], ctx, [...index, i]);
                    }
                }
            }

            ctx.save()
            drawQuadtree(collisionManager._quadtree, ctx, [])
            ctx.restore()
        }

        if (options.enableRatsnest) {
            const colorsRatsnestLines = ['magenta', 'limegreen', 'yellow', 'navy', 'hotpink', 'firebrick', 'purple', 'cornsilk', 'darksalmon'];

            ctx.save()
            ctx.setLineDash([4, 4])
            ctx.lineWidth = 3

            const shouldDraw = (component: FabricObject) => !(component.type.endsWith("/pad") || component.type === "path");
            const trees = collisionManager.getConnectedTrees(shouldDraw)

            function dot(ctx: CanvasRenderingContext2D, elem: FabricObject, radius: number = 4) {
                ctx.beginPath()
                ctx.arc(elem.getX(), elem.getY(), radius, 0, 2 * Math.PI)
                ctx.fill()
            }

            function drawTreeSingleLevel(parent: FabricObject, children: Set<FabricObject>) {
                // draws only one level of the tree = the lines between a parent and all its immediate children
                // also draws a dot on the parent and the children
                dot(ctx, parent)
                for (let child of children) {
                    dot(ctx, child)
                    ctx.beginPath()
                    ctx.moveTo(parent.getX(), parent.getY())
                    ctx.lineTo(child.getX(), child.getY())
                    ctx.stroke()
                }
            }

            let i = 0; // for the rolling colors
            for (let tree of trees) {
                if (tree.size === 0) continue;

                ctx.strokeStyle = colorsRatsnestLines[i++ % colorsRatsnestLines.length] // swap the color for each net
                ctx.fillStyle = ctx.strokeStyle
                tree.forEach((children, parent) => drawTreeSingleLevel(parent, children))
            }
            ctx.restore()
        }

        if (options.enableCollisions) {
            ctx.save()
            ctx.strokeStyle = 'cyan'
            ctx.lineWidth = 1
            const elementsThatAreHitting = collisionManager.debugGetCurrentlyHittingComponents()
            for (let e of elementsThatAreHitting) {
                ctx.strokeRect(
                    e.getX() - e.getBoundingRect().width / 2, e.getY() - e.getBoundingRect().height / 2,
                    e.getBoundingRect().width, e.getBoundingRect().height)
            }
            // draw the texts later so they appear on top of the outlines
            for (let e of elementsThatAreHitting) {
                ctx.fillText(e.type, e.getX(), e.getY())
            }
            ctx.restore()
        }
    })
}

export function setupDebugPane(pane: FolderApi, canvas: Canvas, options: DebugOptions) {
    pane.addBinding(options, "enableQuadtree", {label: "Quadtree"});
    pane.addBinding(options, "enableRatsnest", {label: "Nets"});
    pane.addBinding(options, "enableCollisions", {label: "Collisions"});

    const fps = pane.addBlade({
        view: "fpsgraph",
        label: "FPS",
        rows: 3
    }) as FpsGraphBladeApi

    pane.addButton({title: "Close"}).on("click", () => {
        pane.hidden = true
    })

    pane.on("change", () => canvas?.requestRenderAll())

    const beginEvDisposer = canvas.on("before:render", () => fps.begin())
    const endEvDisposer = canvas.on("after:render", () => fps.end())
    return () => {
        beginEvDisposer()
        endEvDisposer()
    }
}
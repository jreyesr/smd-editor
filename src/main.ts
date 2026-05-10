import {DisplayMode, Engine, PointerScope} from "excalibur";
import {loader} from "./resources";
import {BoardEditorScene} from "./scenes";

const game = new Engine({
    canvasElementId: 'game',
    pointerScope: PointerScope.Canvas,

    width: 1600,
    height: 850,
    displayMode: DisplayMode.Fixed, // Display mode tells excalibur how to fill the window
    scenes: {
        start: BoardEditorScene
    },
    suppressPlayButton: true,
    snapToPixel: true,
});

await game.start('start', {
    loader,
})
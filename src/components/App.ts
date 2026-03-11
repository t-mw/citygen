import config from "../config";
import { generateCity } from "../city-gen/generate";

import { createGameCanvas, type GameCanvasViewState } from "./GameCanvas";
import ToggleButton from "./ToggleButton";

function createButton(text: string, onClick: () => void) {
    const button = document.createElement("button");
    button.textContent = text;
    button.addEventListener("click", onClick);
    return button;
}

function init(root: HTMLElement) {
    const viewState: GameCanvasViewState = {
        debugEnabled: false,
        drawHeatmap: false,
        targetZoom: 0.05 * window.devicePixelRatio,
    };
    const generationState = {
        segmentCountLimit: config.mapGeneration.SEGMENT_COUNT_LIMIT,
    };

    const gameCanvas = createGameCanvas(() => viewState);

    function generate(seed: number) {
        gameCanvas.setCity(
            generateCity(seed, {
                segmentCountLimit: generationState.segmentCountLimit,
            }),
        );
    }

    document.documentElement.style.width = "100%";
    document.documentElement.style.height = "100%";
    document.body.style.margin = "0";
    document.body.style.width = "100%";
    document.body.style.height = "100%";

    root.style.width = "100%";
    root.style.height = "100vh";

    const main = document.createElement("div");
    main.id = "main-viewport-container";
    main.style.position = "relative";
    main.style.width = "100%";
    main.style.height = "100%";
    main.style.overflow = "hidden";

    const canvasHost = document.createElement("div");
    canvasHost.style.position = "absolute";
    canvasHost.style.top = "0";
    canvasHost.style.right = "0";
    canvasHost.style.bottom = "0";
    canvasHost.style.left = "0";
    main.appendChild(canvasHost);

    const controlBar = document.createElement("div");
    controlBar.id = "control-bar";
    controlBar.style.position = "absolute";
    controlBar.style.top = "8px";
    controlBar.style.left = "8px";
    controlBar.style.zIndex = "10";
    controlBar.style.display = "flex";
    controlBar.style.flexWrap = "wrap";
    controlBar.style.gap = "8px";
    controlBar.style.alignItems = "center";
    controlBar.style.padding = "8px";
    controlBar.style.background = "rgba(255, 255, 255, 0.9)";
    controlBar.style.borderRadius = "4px";

    controlBar.appendChild(
        ToggleButton.create({
            onText: "Hide Debug Drawing",
            offText: "Show Debug Drawing",
            action: () => {
                viewState.debugEnabled = !viewState.debugEnabled;
            },
        }),
    );

    controlBar.appendChild(
        ToggleButton.create({
            onText: "Hide Population Heatmap",
            offText: "Show Population Heatmap",
            action: () => {
                viewState.drawHeatmap = !viewState.drawHeatmap;
            },
        }),
    );

    controlBar.appendChild(
        createButton("Zoom in", () => {
            viewState.targetZoom *= 3 / 2;
        }),
    );
    controlBar.appendChild(
        createButton("Zoom out", () => {
            viewState.targetZoom *= 2 / 3;
        }),
    );

    const segmentLimitLabel = document.createElement("label");
    segmentLimitLabel.htmlFor = "segment-limit";
    segmentLimitLabel.textContent = "Segment limit:";
    controlBar.appendChild(segmentLimitLabel);

    const segmentLimitInput = document.createElement("input");
    segmentLimitInput.id = "segment-limit";
    segmentLimitInput.type = "number";
    segmentLimitInput.min = "1";
    segmentLimitInput.max = "5000";
    segmentLimitInput.value = String(generationState.segmentCountLimit);
    segmentLimitInput.addEventListener("change", () => {
        const nextValue = Number(segmentLimitInput.value);
        if (!Number.isFinite(nextValue)) {
            segmentLimitInput.value = String(generationState.segmentCountLimit);
            return;
        }

        generationState.segmentCountLimit = Math.max(1, Math.floor(nextValue));
        segmentLimitInput.value = String(generationState.segmentCountLimit);
    });
    controlBar.appendChild(segmentLimitInput);

    controlBar.appendChild(
        createButton("Regenerate", () => {
            generate(new Date().getTime());
        }),
    );

    main.appendChild(controlBar);
    root.appendChild(main);
    gameCanvas.mount(canvasHost);

    const seed = new Date().getTime();
    console.log(`seed: ${seed.toString()}`);
    generate(seed);
}

const App = {
    init,
};

export default App;

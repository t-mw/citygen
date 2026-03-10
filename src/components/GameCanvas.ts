import {
    Container,
    Graphics,
    autoDetectRenderer,
    type FederatedPointerEvent,
    type Renderer,
} from "pixi.js";

import Quadtree from "@timohausmann/quadtree-js";

import { type CollisionLimits } from "../collision";
import math, { type Point } from "../math";
import astar from "../astar";

import config from "../config";
import { type Segment } from "../mapgen";

import MapStore from "../MapStore";

type CanvasBuilding = ReturnType<typeof MapStore.getBuildings>[number];
type MapPathLocation = InstanceType<typeof astar.PathLocation>;
type DebugData = ReturnType<typeof MapStore.getDebugData>;
type Heatmap = ReturnType<typeof MapStore.getHeatmap>;
type SegmentQTreeEntry = CollisionLimits<Segment> & { o: Segment };
type SegmentQuadtree = Quadtree<SegmentQTreeEntry>;

interface ClosestSegmentMatch {
    closestMatch: SegmentQTreeEntry | undefined;
    minDistance2: number | undefined;
    matchFraction: number | undefined;
}

interface PointerPosition {
    x: number;
    y: number;
}

let pixiRenderer: Renderer | undefined;
const pointerPosition: PointerPosition = {
    x: 0,
    y: 0,
};

const stage = new Container();
stage.eventMode = "static";

const heatmaps = new Container();
const debugDrawables = new Container();
const debugSegments = new Container();
const debugMapData = new Container();
const zoomContainer = new Container();
const drawables = new Container();
// for roads and buildings
const dynamicDrawables = new Container();

stage.addChild(heatmaps);
debugDrawables.addChild(debugSegments);
debugDrawables.addChild(debugMapData);
drawables.addChild(dynamicDrawables);
zoomContainer.addChild(drawables);
stage.addChild(zoomContainer);

let firstSelection = true;
let pathSelectionStart: MapPathLocation | undefined;

let segments: Segment[] = [];
let qTree: SegmentQuadtree | undefined;
let heatmap: Heatmap | undefined;
let debugData: DebugData | undefined;

let debugSegmentI = 0;
let touchDown = false;
let diffX = 0;
let diffY = 0;
const cumulDiff = {
    x: 0,
    y: 0,
};
let prevX: number | null = null;
let prevY: number | null = null;
let zoom = 0.01 * window.devicePixelRatio;
let debugDrawablesAdded = false;
let populationHeatMap: Graphics | undefined;
let debugLinksGraphics: Container | undefined;
let pathGraphics: Graphics | undefined;
let pickupRangeIndicator: Graphics | undefined;

let canvasContainerEl: HTMLElement | undefined;
let mounted = false;

const camera = {
    x: 0,
    y: -500,
    vx: 0,
    vy: 0,
};

function unitRgbToHex(red: number, green: number, blue: number): number {
    const r = Math.max(0, Math.min(255, Math.round(red * 255)));
    const g = Math.max(0, Math.min(255, Math.round(green * 255)));
    const b = Math.max(0, Math.min(255, Math.round(blue * 255)));

    return (r << 16) | (g << 8) | b;
}

function handlePointerDown(event: FederatedPointerEvent) {
    pointerPosition.x = event.global.x;
    pointerPosition.y = event.global.y;
    touchDown = true;
    prevX = event.global.x;
    prevY = event.global.y;
}

function handlePointerUp(event: FederatedPointerEvent) {
    pointerPosition.x = event.global.x;
    pointerPosition.y = event.global.y;
    touchDown = false;

    if (math.lengthV2(cumulDiff) <= config.gameLogic.SELECT_PAN_THRESHOLD) {
        // not the exact location of the beginning of the click, good enough
        clickEvent(event.global.x, event.global.y);
    }

    cumulDiff.x = 0;
    cumulDiff.y = 0;
}

function handlePointerMove(event: FederatedPointerEvent) {
    pointerPosition.x = event.global.x;
    pointerPosition.y = event.global.y;
}

stage.on("pointerdown", handlePointerDown);
stage.on("pointerup", handlePointerUp);
stage.on("pointerupoutside", handlePointerUp);
stage.on("globalpointermove", handlePointerMove);

const graphics = new Graphics();
graphics
    .moveTo(0, 50)
    .lineTo(0, 0)
    .stroke({ width: 4, color: unitRgbToHex(0, 1, 0) });
graphics
    .moveTo(0, 0)
    .lineTo(50, 0)
    .stroke({ width: 4, color: unitRgbToHex(1, 0, 1) });
debugDrawables.addChild(graphics);

function closestSegment(location: Point): ClosestSegmentMatch {
    if (qTree == null) {
        return {
            closestMatch: undefined,
            minDistance2: undefined,
            matchFraction: undefined,
        };
    }

    const { x, y } = location;
    const matches = qTree.retrieve({
        x,
        y,
        width: 1,
        height: 1,
    });

    let minVal = Number.POSITIVE_INFINITY;
    let closestMatch: SegmentQTreeEntry | undefined;
    let minDistance2: number | undefined;
    let matchFraction: number | undefined;

    for (const match of matches) {
        const { distance2, lineProj2, length2 } = math.distanceToLine(
            { x, y },
            match.o.r.start,
            match.o.r.end,
        );
        const val =
            lineProj2 <= length2 && lineProj2 >= 0
                ? distance2
                : Number.POSITIVE_INFINITY;

        if (closestMatch == null || val < minVal) {
            minVal = val;
            closestMatch = match;
            minDistance2 = distance2;
            matchFraction = Math.sqrt(lineProj2) / match.o.length();
        }
    }

    return {
        closestMatch,
        minDistance2,
        matchFraction,
    };
}

function clickEvent(clickX: number, clickY: number) {
    const worldClick = {
        x: (clickX - zoomContainer.x) / zoom + camera.x,
        y: (clickY - zoomContainer.y) / zoom + camera.y,
    };

    const { closestMatch, minDistance2, matchFraction } =
        closestSegment(worldClick);

    // draw mouse click
    const clickGraphics = new Graphics();
    drawables.addChild(clickGraphics);
    clickGraphics
        .circle(worldClick.x, worldClick.y, 4)
        .fill({ color: 0xffffff, alpha: 1 });

    if (
        closestMatch != null &&
        minDistance2 != null &&
        matchFraction != null &&
        Math.sqrt(minDistance2) * zoom < config.gameLogic.SELECTION_RANGE
    ) {
        if (firstSelection) {
            pathSelectionStart = new astar.PathLocation(
                closestMatch.o,
                matchFraction,
            );
            firstSelection = false;
        } else if (pathSelectionStart != null) {
            const pathSelectionEnd = new astar.PathLocation(
                closestMatch.o,
                matchFraction,
            );
            firstSelection = true;

            const path = astar.calc.find(
                pathSelectionStart,
                pathSelectionEnd,
            ) as Segment[];
            if (pathGraphics == null) {
                pathGraphics = new Graphics();
                drawables.addChild(pathGraphics);
            } else if (pathGraphics.children.length > 0) {
                pathGraphics.removeChildren();
            }

            for (const pathSegment of path) {
                pathGraphics.addChild(drawSegment(pathSegment, 0xffffff, 25));
            }
        }

        console.log(`${segments.indexOf(closestMatch.o).toString()} clicked`);

        if (config.mapGeneration.DEBUG) {
            if (debugLinksGraphics != null) {
                debugDrawables.removeChild(debugLinksGraphics);
            }

            debugLinksGraphics = new Container();
            closestMatch.o.debugLinks();
            debugLinksGraphics.addChild(drawSegment(closestMatch.o));

            for (const link of closestMatch.o.links.f) {
                debugLinksGraphics.addChild(drawSegment(link));
            }

            for (const link of closestMatch.o.links.b) {
                debugLinksGraphics.addChild(drawSegment(link));
            }

            debugDrawables.addChild(debugLinksGraphics);
        }
    }
}

function drawSegment(
    segment: Segment,
    color: number | null = null,
    width: number | null = null,
) {
    const resolvedColor = color ?? segment.q.color ?? 0xa1afa9;
    const resolvedWidth = width ?? segment.width;

    const segmentGraphics = new Graphics();
    segmentGraphics
        .circle(segment.r.start.x, segment.r.start.y, 2)
        .moveTo(segment.r.start.x, segment.r.start.y)
        .lineTo(segment.r.end.x, segment.r.end.y)
        .circle(segment.r.end.x, segment.r.end.y, 2)
        .stroke({ width: resolvedWidth, color: resolvedColor });

    return segmentGraphics;
}

function animate() {
    const renderer = pixiRenderer;
    if (renderer == null) {
        return;
    }

    zoom = (zoom + MapStore.getTargetZoom()) / 2.0;
    zoomContainer.scale.x = zoom;
    zoomContainer.scale.y = zoom;

    if (config.mapGeneration.DRAW_HEATMAP && heatmap != null) {
        if (populationHeatMap == null) {
            populationHeatMap = new Graphics();
            heatmaps.addChild(populationHeatMap);
        } else {
            populationHeatMap.clear();
        }

        const w = renderer.width;
        const h = renderer.height;

        for (let x = 0; x < w; x += config.mapGeneration.HEAT_MAP_PIXEL_DIM) {
            for (
                let y = 0;
                y < h;
                y += config.mapGeneration.HEAT_MAP_PIXEL_DIM
            ) {
                const xSample =
                    (x +
                        config.mapGeneration.HEAT_MAP_PIXEL_DIM / 2 -
                        zoomContainer.x) /
                        zoom +
                    camera.x;
                const ySample =
                    (y +
                        config.mapGeneration.HEAT_MAP_PIXEL_DIM / 2 -
                        zoomContainer.y) /
                        zoom +
                    camera.y;
                const value = heatmap.populationAt(xSample, ySample);

                populationHeatMap
                    .rect(
                        x,
                        y,
                        config.mapGeneration.HEAT_MAP_PIXEL_DIM,
                        config.mapGeneration.HEAT_MAP_PIXEL_DIM,
                    )
                    .fill({ color: unitRgbToHex(0, value, 0) });
            }
        }
    } else if (populationHeatMap != null) {
        heatmaps.removeChild(populationHeatMap);
        populationHeatMap = undefined;
    }

    if (config.mapGeneration.DEBUG && !debugDrawablesAdded) {
        debugDrawablesAdded = true;
        drawables.addChild(debugDrawables);
    } else if (!config.mapGeneration.DEBUG && debugDrawablesAdded) {
        debugDrawablesAdded = false;
        drawables.removeChild(debugDrawables);
    }

    if (config.mapGeneration.DEBUG && debugSegmentI < segments.length) {
        const toDraw = segments[debugSegmentI];
        debugSegmentI += 1;
        debugSegments.addChild(drawSegment(toDraw, 0x77aa77, 25));
    } else if (!config.mapGeneration.DEBUG && debugSegmentI > 0) {
        debugSegmentI = 0;
        if (debugSegments.children.length > 0) {
            debugSegments.removeChildren();
        }
    }

    const touchX = pointerPosition.x;
    const touchY = pointerPosition.y;

    if (pickupRangeIndicator == null) {
        pickupRangeIndicator = new Graphics();
        pickupRangeIndicator
            .circle(0, 0, config.gameLogic.DEFAULT_PICKUP_RANGE)
            .fill({ color: 0xff0000, alpha: 0.3 })
            .stroke({ width: 4, color: 0xff0000 });

        drawables.addChild(pickupRangeIndicator);
    }

    const closest = closestSegment({
        x: (touchX - zoomContainer.x) / zoom + camera.x,
        y: (touchY - zoomContainer.y) / zoom + camera.y,
    });

    if (
        closest.closestMatch != null &&
        closest.minDistance2 != null &&
        closest.matchFraction != null &&
        closest.minDistance2 <=
            config.gameLogic.DEFAULT_PICKUP_RANGE *
                config.gameLogic.DEFAULT_PICKUP_RANGE
    ) {
        const matchPoint = math.fractionBetween(
            closest.closestMatch.o.r.start,
            closest.closestMatch.o.r.end,
            closest.matchFraction,
        );
        pickupRangeIndicator.x = matchPoint.x;
        pickupRangeIndicator.y = matchPoint.y;
    }

    if (touchDown) {
        // check if outside area
        if (touchX > 0 && touchY > 0 && prevX != null && prevY != null) {
            diffX = touchX - prevX;
            diffY = touchY - prevY;
            prevX = touchX;
            prevY = touchY;
        }

        cumulDiff.x += diffX;
        cumulDiff.y += diffY;

        // invert for swiping motion
        camera.vx = -diffX / zoom;
        camera.vy = -diffY / zoom;
        camera.x += camera.vx;
        camera.y += camera.vy;
    }

    if (!touchDown) {
        camera.x += camera.vx;
        camera.y += camera.vy;
        // stickiness
        camera.vx *= 0.8;
        camera.vy *= 0.8;
    }

    drawables.x = -camera.x;
    drawables.y = -camera.y;

    renderer.render({ container: stage });
    requestAnimationFrame(animate);
}

function handleResize() {
    if (canvasContainerEl == null || pixiRenderer == null) {
        return;
    }

    const width = canvasContainerEl.offsetWidth;
    const height = canvasContainerEl.offsetHeight;
    const rendererWidth = Math.max(1, width * window.devicePixelRatio);
    const rendererHeight = Math.max(1, height * window.devicePixelRatio);

    pixiRenderer.resize(rendererWidth, rendererHeight);
    stage.hitArea = pixiRenderer.screen;

    const canvas = pixiRenderer.canvas;
    canvas.style.display = "block";
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";

    zoomContainer.x = pixiRenderer.width / 2;
    zoomContainer.y = pixiRenderer.height / 2;
}

function onMapChange() {
    if (pathGraphics != null && pathGraphics.children.length > 0) {
        pathGraphics.removeChildren();
    }

    if (dynamicDrawables.children.length > 0) {
        dynamicDrawables.removeChildren();
    }

    segments = MapStore.getSegments();
    const buildings: CanvasBuilding[] = MapStore.getBuildings();
    qTree = MapStore.getQTree() as SegmentQuadtree;
    heatmap = MapStore.getHeatmap();
    debugData = MapStore.getDebugData();

    if (debugMapData.children.length > 0) {
        debugMapData.removeChildren();
    }

    debugSegmentI = 0;
    if (debugSegments.children.length > 0) {
        debugSegments.removeChildren();
    }

    for (const point of debugData.snaps ?? []) {
        const snapGraphics = new Graphics();
        snapGraphics.circle(point.x, point.y, 20).fill({ color: 0x00ff00 });
        debugMapData.addChild(snapGraphics);
    }

    for (const point of debugData.intersectionsRadius ?? []) {
        const intersectionRadiusGraphics = new Graphics();
        intersectionRadiusGraphics
            .circle(point.x, point.y, 20)
            .fill({ color: 0x0000ff });
        debugMapData.addChild(intersectionRadiusGraphics);
    }

    for (const point of debugData.intersections ?? []) {
        const intersectionGraphics = new Graphics();
        intersectionGraphics
            .circle(point.x, point.y, 20)
            .fill({ color: 0xff0000 });
        debugMapData.addChild(intersectionGraphics);
    }

    for (const building of buildings) {
        const buildingGraphics = new Graphics();
        buildingGraphics
            .moveTo(building.corners[0].x, building.corners[0].y)
            .lineTo(building.corners[1].x, building.corners[1].y)
            .lineTo(building.corners[2].x, building.corners[2].y)
            .lineTo(building.corners[3].x, building.corners[3].y)
            .lineTo(building.corners[0].x, building.corners[0].y)
            .fill({ color: 0x0c161f })
            .stroke({ width: 5, color: 0x555555 });

        dynamicDrawables.addChild(buildingGraphics);
    }

    for (const segment of segments) {
        const lineColor = segment.q.color ?? 0xa1afa9;
        dynamicDrawables.addChild(drawSegment(segment, lineColor));
    }
}

async function initializeRenderer() {
    if (canvasContainerEl == null) {
        return;
    }

    pixiRenderer = await autoDetectRenderer({
        width: Math.max(
            1,
            canvasContainerEl.offsetWidth * window.devicePixelRatio,
        ),
        height: Math.max(
            1,
            canvasContainerEl.offsetHeight * window.devicePixelRatio,
        ),
        backgroundColor: 0x3d7228,
        antialias: true,
    });

    canvasContainerEl.appendChild(pixiRenderer.canvas);
    handleResize();

    window.addEventListener("resize", handleResize);
    requestAnimationFrame(() => {
        handleResize();
        animate();
    });
}

function mount(hostEl: HTMLElement) {
    if (mounted) {
        return;
    }

    mounted = true;

    canvasContainerEl = document.createElement("div");
    canvasContainerEl.id = "canvas-container";
    canvasContainerEl.style.position = "absolute";
    canvasContainerEl.style.top = "0";
    canvasContainerEl.style.right = "0";
    canvasContainerEl.style.bottom = "0";
    canvasContainerEl.style.left = "0";
    canvasContainerEl.style.width = "100%";
    canvasContainerEl.style.height = "100%";

    hostEl.appendChild(canvasContainerEl);

    MapStore.addChangeListener(onMapChange);

    const seed = new Date().getTime();
    console.log(`seed: ${seed.toString()}`);

    void initializeRenderer();
    MapStore.generate(seed);
}

const GameCanvas = {
    mount,
};

export default GameCanvas;

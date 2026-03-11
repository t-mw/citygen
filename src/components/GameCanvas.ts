import {
    Container,
    Graphics,
    autoDetectRenderer,
    type FederatedPointerEvent,
    type Renderer,
} from "pixi.js";

import config from "../config";
import math, { type Point } from "../math";
import { findPath, type PathLocation } from "../pathfinding";

import { type CityData } from "../city-gen/generate";
import { type Segment, type SegmentQuadtree } from "../city-gen/segment";

export interface GameCanvasViewState {
    debugEnabled: boolean;
    drawHeatmap: boolean;
    targetZoom: number;
}

type CanvasBuilding = CityData["buildings"][number];
type Heatmap = CityData["heatmap"];

interface ClosestSegmentMatch {
    segment: Segment | null;
    minDistance2: number | null;
    fraction: number | null;
}

interface PointerPosition {
    x: number;
    y: number;
}

function unitRgbToHex(red: number, green: number, blue: number): number {
    const r = Math.max(0, Math.min(255, Math.round(red * 255)));
    const g = Math.max(0, Math.min(255, Math.round(green * 255)));
    const b = Math.max(0, Math.min(255, Math.round(blue * 255)));

    return (r << 16) | (g << 8) | b;
}

function createGameCanvas(getViewState: () => GameCanvasViewState) {
    let pixiRenderer: Renderer | null = null;
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
    const clickMarkers = new Container();
    const dynamicDrawables = new Container();

    stage.addChild(heatmaps);
    debugDrawables.addChild(debugSegments);
    debugDrawables.addChild(debugMapData);
    drawables.addChild(clickMarkers);
    drawables.addChild(dynamicDrawables);
    zoomContainer.addChild(drawables);
    stage.addChild(zoomContainer);

    let segments: Segment[] = [];
    let qTree: SegmentQuadtree | null = null;
    let heatmap: Heatmap | null = null;
    let firstPathSelection = true;
    let pathSelectionStart: PathLocation | null = null;

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
    let populationHeatMap: Graphics | null = null;
    let pickupRangeIndicator: Graphics | null = null;
    let selectedDebugGraphics: Container | null = null;
    let pathGraphics: Container | null = null;

    let canvasContainerEl: HTMLElement | null = null;
    let mounted = false;

    const camera = {
        x: 0,
        y: -500,
        vx: 0,
        vy: 0,
    };

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

    function getWorldPoint(screenX: number, screenY: number) {
        return {
            x: (screenX - zoomContainer.x) / zoom + camera.x,
            y: (screenY - zoomContainer.y) / zoom + camera.y,
        };
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

        if (
            math.lengthV2(cumulDiff) <= config.interaction.SELECT_PAN_THRESHOLD
        ) {
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
                segment: null,
                minDistance2: null,
                fraction: null,
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
        let nearestSegment: Segment | null = null;
        let minDistance2: number | null = null;
        let closestFraction: number | null = null;

        for (const match of matches) {
            if (match.o == null) {
                continue;
            }

            const segment = match.o;
            const { distance2, lineProj2, length2 } = math.distanceToLine(
                { x, y },
                segment.r.start,
                segment.r.end,
            );
            const val =
                lineProj2 <= length2 && lineProj2 >= 0
                    ? distance2
                    : Number.POSITIVE_INFINITY;

            if (nearestSegment == null || val < minVal) {
                minVal = val;
                nearestSegment = segment;
                minDistance2 = distance2;
                closestFraction = Math.sqrt(lineProj2) / segment.length();
            }
        }

        return {
            segment: nearestSegment,
            minDistance2,
            fraction: closestFraction,
        };
    }

    function clearSelectedDebugGraphics() {
        if (selectedDebugGraphics == null) {
            return;
        }

        debugDrawables.removeChild(selectedDebugGraphics);
        selectedDebugGraphics = null;
    }

    function clearPathGraphics() {
        if (pathGraphics == null) {
            return;
        }

        drawables.removeChild(pathGraphics);
        pathGraphics = null;
    }

    function addClickMarker(point: Point) {
        const clickGraphics = new Graphics();
        clickGraphics.circle(point.x, point.y, 32).fill({
            color: 0xffffff,
            alpha: 1,
        });
        clickMarkers.addChild(clickGraphics);
    }

    function clearClickMarkers() {
        if (clickMarkers.children.length > 0) {
            clickMarkers.removeChildren();
        }
    }

    function drawPathSegment(start: Point, end: Point) {
        const segmentGraphics = new Graphics();
        segmentGraphics
            .moveTo(start.x, start.y)
            .lineTo(end.x, end.y)
            .stroke({ width: 25, color: 0xffffff });
        return segmentGraphics;
    }

    function drawPath(path: Segment[], start: PathLocation, end: PathLocation) {
        clearPathGraphics();

        if (path.length === 0) {
            return;
        }

        const startPoint = start.segment.pointAt(start.fraction);
        const endPoint = end.segment.pointAt(end.fraction);

        pathGraphics = new Container();

        if (path.length === 1) {
            pathGraphics.addChild(drawPathSegment(startPoint, endPoint));
            drawables.addChild(pathGraphics);
            return;
        }

        const startExitPoint = path[0].connectionPoint(path[1]);
        pathGraphics.addChild(drawPathSegment(startPoint, startExitPoint));

        for (const segment of path.slice(1, -1)) {
            pathGraphics.addChild(drawSegment(segment, 0xffffff, 25));
        }

        const lastSegment = path[path.length - 1];
        const previousSegment = path[path.length - 2];
        const endEntryPoint = lastSegment.connectionPoint(previousSegment);
        pathGraphics.addChild(drawPathSegment(endEntryPoint, endPoint));

        drawables.addChild(pathGraphics);
    }

    function updateDebugSelection(segment: Segment) {
        if (!getViewState().debugEnabled) {
            clearSelectedDebugGraphics();
            return;
        }

        clearSelectedDebugGraphics();

        selectedDebugGraphics = new Container();
        segment.debugLinks();
        selectedDebugGraphics.addChild(drawSegment(segment));

        for (const link of segment.links.f) {
            selectedDebugGraphics.addChild(drawSegment(link));
        }

        for (const link of segment.links.b) {
            selectedDebugGraphics.addChild(drawSegment(link));
        }

        debugDrawables.addChild(selectedDebugGraphics);
    }

    function clickEvent(clickX: number, clickY: number) {
        const worldClick = getWorldPoint(clickX, clickY);
        const { segment, minDistance2, fraction } = closestSegment(worldClick);

        if (
            segment == null ||
            minDistance2 == null ||
            fraction == null ||
            Math.sqrt(minDistance2) * zoom >= config.interaction.SELECTION_RANGE
        ) {
            clearSelectedDebugGraphics();
            return;
        }

        const snappedPoint = segment.pointAt(fraction);

        updateDebugSelection(segment);

        const currentSelection: PathLocation = {
            segment,
            fraction,
        };

        if (firstPathSelection) {
            clearClickMarkers();
            clearPathGraphics();
            addClickMarker(snappedPoint);
            firstPathSelection = false;
            pathSelectionStart = currentSelection;
        } else if (pathSelectionStart != null) {
            addClickMarker(snappedPoint);
            drawPath(
                findPath(pathSelectionStart, currentSelection),
                pathSelectionStart,
                currentSelection,
            );
            firstPathSelection = true;
            pathSelectionStart = null;
        }

        console.log(`${segments.indexOf(segment).toString()} clicked`);
    }

    function animate() {
        const renderer = pixiRenderer;
        if (renderer == null) {
            return;
        }

        const viewState = getViewState();
        zoom = (zoom + viewState.targetZoom) / 2.0;
        zoomContainer.scale.x = zoom;
        zoomContainer.scale.y = zoom;

        if (viewState.drawHeatmap && heatmap != null) {
            if (populationHeatMap == null) {
                populationHeatMap = new Graphics();
                heatmaps.addChild(populationHeatMap);
            } else {
                populationHeatMap.clear();
            }

            const w = renderer.width;
            const h = renderer.height;

            for (
                let x = 0;
                x < w;
                x += config.mapGeneration.HEAT_MAP_PIXEL_DIM
            ) {
                for (
                    let y = 0;
                    y < h;
                    y += config.mapGeneration.HEAT_MAP_PIXEL_DIM
                ) {
                    const samplePoint = getWorldPoint(
                        x + config.mapGeneration.HEAT_MAP_PIXEL_DIM / 2,
                        y + config.mapGeneration.HEAT_MAP_PIXEL_DIM / 2,
                    );
                    const value = heatmap.populationAt(
                        samplePoint.x,
                        samplePoint.y,
                    );

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
            populationHeatMap = null;
        }

        if (viewState.debugEnabled && !debugDrawablesAdded) {
            debugDrawablesAdded = true;
            drawables.addChild(debugDrawables);
        } else if (!viewState.debugEnabled && debugDrawablesAdded) {
            debugDrawablesAdded = false;
            drawables.removeChild(debugDrawables);
        }

        if (viewState.debugEnabled && debugSegmentI < segments.length) {
            const toDraw = segments[debugSegmentI];
            debugSegmentI += 1;
            debugSegments.addChild(drawSegment(toDraw, 0x77aa77, 25));
        } else if (!viewState.debugEnabled && debugSegmentI > 0) {
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
                .circle(0, 0, config.interaction.DEFAULT_PICKUP_RANGE)
                .fill({ color: 0xff0000, alpha: 0.3 })
                .stroke({ width: 4, color: 0xff0000 });
            pickupRangeIndicator.visible = false;
            drawables.addChild(pickupRangeIndicator);
        }

        const closest = closestSegment(getWorldPoint(touchX, touchY));

        if (
            closest.segment != null &&
            closest.minDistance2 != null &&
            closest.fraction != null &&
            closest.minDistance2 <=
                config.interaction.DEFAULT_PICKUP_RANGE *
                    config.interaction.DEFAULT_PICKUP_RANGE
        ) {
            const matchPoint = closest.segment.pointAt(closest.fraction);
            pickupRangeIndicator.x = matchPoint.x;
            pickupRangeIndicator.y = matchPoint.y;
            pickupRangeIndicator.visible = true;
        } else {
            pickupRangeIndicator.visible = false;
        }

        if (touchDown) {
            if (touchX > 0 && touchY > 0 && prevX != null && prevY != null) {
                diffX = touchX - prevX;
                diffY = touchY - prevY;
                prevX = touchX;
                prevY = touchY;
            }

            cumulDiff.x += diffX;
            cumulDiff.y += diffY;

            camera.vx = -diffX / zoom;
            camera.vy = -diffY / zoom;
            camera.x += camera.vx;
            camera.y += camera.vy;
        }

        if (!touchDown) {
            camera.x += camera.vx;
            camera.y += camera.vy;
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

    function setCity(city: CityData) {
        clearClickMarkers();

        if (dynamicDrawables.children.length > 0) {
            dynamicDrawables.removeChildren();
        }

        segments = city.segments;
        const buildings: CanvasBuilding[] = city.buildings;
        qTree = city.qTree;
        heatmap = city.heatmap;
        const { debugData } = city;

        firstPathSelection = true;
        pathSelectionStart = null;
        clearPathGraphics();
        clearSelectedDebugGraphics();

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
        void initializeRenderer();
    }

    return {
        mount,
        setCity,
    };
}

export { createGameCanvas };

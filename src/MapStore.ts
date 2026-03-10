import mapgen, { type Segment } from "./mapgen";

type MapgenResult = ReturnType<typeof mapgen.generate>;

let segments: Segment[] = [];
let buildings: MapgenResult["buildings"] = [];
let qTree: MapgenResult["qTree"];
let heatmap: MapgenResult["heatmap"];
let debugData: MapgenResult["debugData"];
let targetZoom = 0.05 * window.devicePixelRatio;
const changeListeners = new Set<() => void>();

const MapStore = {
    // NB: returns an array, should not be indexed by segment_id.
    getSegments() {
        return segments;
    },

    getBuildings() {
        return buildings;
    },

    getQTree() {
        return qTree;
    },

    getHeatmap() {
        return heatmap;
    },

    getDebugData() {
        return debugData;
    },

    getTargetZoom() {
        return targetZoom;
    },

    emitChange() {
        for (const listener of changeListeners) {
            listener();
        }
    },

    addChangeListener(callback: () => void) {
        changeListeners.add(callback);
    },

    removeChangeListener(callback: () => void) {
        changeListeners.delete(callback);
    },

    generate(seed: number) {
        const result = mapgen.generate(seed);
        segments = result.segments;
        buildings = result.buildings;
        qTree = result.qTree;
        heatmap = result.heatmap;
        debugData = result.debugData;

        MapStore.emitChange();
    },

    factorTargetZoom(factor: number) {
        targetZoom *= factor;
    },
};

export default MapStore;

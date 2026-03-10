declare module "@timohausmann/quadtree-js" {
    export interface QuadtreeBounds {
        x: number;
        y: number;
        width: number;
        height: number;
    }

    export default class Quadtree<T extends QuadtreeBounds = QuadtreeBounds> {
        constructor(
            bounds: QuadtreeBounds,
            maxObjects?: number,
            maxLevels?: number,
            level?: number,
        );
        insert(item: T): void;
        retrieve(area: QuadtreeBounds): T[];
    }
}

import noisejs from "noisejs";

import { type Road } from "./segment";

const noise = new noisejs.Noise();

export interface PopulationHeatmap {
    popOnRoad(road: Road): number;
    populationAt(x: number, y: number): number;
}

export function seedPopulationHeatmap(seed: number) {
    noise.seed(seed);
}

export const populationHeatmap: PopulationHeatmap = {
    popOnRoad(road: Road) {
        return (
            (this.populationAt(road.start.x, road.start.y) +
                this.populationAt(road.end.x, road.end.y)) /
            2
        );
    },

    populationAt(x: number, y: number) {
        const value1 = (noise.simplex2(x / 10000, y / 10000) + 1) / 2;
        const value2 =
            (noise.simplex2(x / 20000 + 500, y / 20000 + 500) + 1) / 2;
        const value3 =
            (noise.simplex2(x / 20000 + 1000, y / 20000 + 1000) + 1) / 2;
        return Math.pow((value1 * value2 + value3) / 2, 2);
    },
};

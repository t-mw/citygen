import config from "./config";

import { type Segment } from "./city-gen/segment";

export interface PathLocation {
    segment: Segment;
    fraction: number;
}

function segmentSpeed(segment: Segment) {
    if (segment.q.highway) {
        return config.pathfinding.HIGHWAY_SEGMENT_SPEED;
    }

    return config.pathfinding.DEFAULT_SEGMENT_SPEED;
}

function segmentTravelCost(segment: Segment, distance: number) {
    return distance / segmentSpeed(segment);
}

function segmentCostToNeighbour(
    segment: Segment,
    other: Segment,
    fromFraction: number | null,
) {
    if (fromFraction == null) {
        return segmentTravelCost(segment, segment.length() * 0.5);
    }

    if (segment.connectedAtStart(other)) {
        return segmentTravelCost(segment, segment.length() * fromFraction);
    }

    return segmentTravelCost(segment, segment.length() * (1 - fromFraction));
}

function stepCost(
    current: Segment,
    next: Segment,
    start: PathLocation,
    end: PathLocation,
) {
    if (start.segment === end.segment) {
        return segmentTravelCost(
            current,
            Math.abs(start.fraction - end.fraction) * current.length(),
        );
    }

    const currentFraction = current === start.segment ? start.fraction : null;
    const nextFraction = next === end.segment ? end.fraction : null;

    return (
        segmentCostToNeighbour(current, next, currentFraction) +
        segmentCostToNeighbour(next, current, nextFraction)
    );
}

function neighbours(segment: Segment) {
    return segment.links.f.concat(segment.links.b);
}

export function findPath(start: PathLocation, end: PathLocation) {
    const frontier: { segment: Segment; priority: number }[] = [
        { segment: start.segment, priority: 0 },
    ];

    const cameFrom = new Map<Segment, Segment | null>();
    cameFrom.set(start.segment, null);

    const costSoFar = new Map<Segment, number>();
    costSoFar.set(start.segment, 0);

    while (frontier.length > 0) {
        frontier.sort((a, b) => a.priority - b.priority);
        const current = frontier.shift() ?? null;
        if (current == null) {
            break;
        }

        if (current.segment === end.segment) {
            break;
        }

        for (const next of neighbours(current.segment)) {
            const currentCost = costSoFar.get(current.segment) ?? null;
            if (currentCost == null) {
                continue;
            }

            const newCost =
                currentCost + stepCost(current.segment, next, start, end);
            const existingCost = costSoFar.get(next) ?? null;

            if (existingCost == null || newCost < existingCost) {
                costSoFar.set(next, newCost);
                frontier.push({ segment: next, priority: newCost });
                cameFrom.set(next, current.segment);
            }
        }
    }

    if (!cameFrom.has(end.segment)) {
        return [];
    }

    const path: Segment[] = [end.segment];
    let current: Segment | null = end.segment;

    while (current !== start.segment) {
        current = cameFrom.get(current) ?? null;
        if (current == null) {
            return [];
        }

        path.unshift(current);
    }

    return path;
}

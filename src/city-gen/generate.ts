import Quadtree from "@timohausmann/quadtree-js";
import seedrandom from "seedrandom";

import config from "../config";
import math, { type Point } from "../math";

import { type Building, generateBuildings } from "./buildings";
import {
    Segment,
    cloneSegment,
    createSegmentUsingDirection,
    insertSegment,
    type Road,
    type SegmentMeta,
    type SegmentQuadtree,
} from "./segment";
import {
    populationHeatmap,
    seedPopulationHeatmap,
    type PopulationHeatmap,
} from "./heatmap";

interface DebugData {
    intersections?: Point[];
    snaps?: Point[];
    intersectionsRadius?: Point[];
}

type RoadIntersection = false | { x: number; y: number; t: number };

function minDegreeDifference(d1: number, d2: number) {
    const diff = Math.abs(d1 - d2) % 180;
    return Math.min(diff, Math.abs(diff - 180));
}

function doRoadSegmentsIntersect(r1: Road, r2: Road): RoadIntersection {
    return math.doLineSegmentsIntersect(
        r1.start,
        r1.end,
        r2.start,
        r2.end,
        true,
    ) as RoadIntersection;
}

function localConstraints(
    segment: Segment,
    segments: Segment[],
    qTree: SegmentQuadtree,
    debugData: DebugData,
) {
    const action = {
        priority: 0,
        func: null as (() => boolean) | null,
    };
    let closestIntersectionT: number | null = null;

    const snapDistance = config.mapGeneration.ROAD_SNAP_DISTANCE;
    const snapDistance2 = snapDistance * snapDistance;
    const matches = qTree.retrieve(segment.collider.limits());

    for (const match of matches) {
        const other = match.o ?? null;
        if (other == null) {
            continue;
        }

        // intersection check
        if (action.priority <= 4) {
            const intersection = doRoadSegmentsIntersect(segment.r, other.r);
            if (
                intersection &&
                (closestIntersectionT == null ||
                    intersection.t < closestIntersectionT)
            ) {
                closestIntersectionT = intersection.t;
                const currentOther = other;
                const currentIntersection = intersection;

                action.priority = 4;
                action.func = () => {
                    // if intersecting lines are too similar don't continue
                    if (
                        minDegreeDifference(currentOther.dir(), segment.dir()) <
                        config.mapGeneration.MINIMUM_INTERSECTION_DEVIATION
                    ) {
                        return false;
                    }

                    currentOther.split(
                        currentIntersection,
                        segment,
                        segments,
                        qTree,
                    );
                    segment.r.setEnd(currentIntersection);
                    segment.q.severed = true;
                    debugData.intersections ??= [];
                    debugData.intersections.push({
                        x: currentIntersection.x,
                        y: currentIntersection.y,
                    });

                    return true;
                };
            }
        }

        // snap to crossing within radius check
        if (action.priority <= 3) {
            // current segment's start must have been checked to have been created.
            // other segment's start must have a corresponding end.
            if (math.length(segment.r.end, other.r.end) <= snapDistance) {
                const currentOther = other;
                const point = other.r.end;

                action.priority = 3;
                action.func = () => {
                    segment.r.setEnd(point);
                    segment.q.severed = true;

                    // update links of otherSegment corresponding to other.r.end
                    const links = currentOther.startIsBackwards()
                        ? currentOther.links.f
                        : currentOther.links.b;
                    // check for duplicate lines, don't add if it exists
                    // this should be done before links are setup, to avoid having to undo that step
                    if (
                        links.some((link) => {
                            return (
                                (math.equalV(link.r.start, segment.r.end) &&
                                    math.equalV(link.r.end, segment.r.start)) ||
                                (math.equalV(link.r.start, segment.r.start) &&
                                    math.equalV(link.r.end, segment.r.end))
                            );
                        })
                    ) {
                        return false;
                    }

                    for (const link of links) {
                        // pick links of remaining segments at junction corresponding to other.r.end
                        const endLinks =
                            link.linksForEndContaining(currentOther);
                        if (endLinks == null) {
                            throw new Error("Expected segment end links");
                        }

                        endLinks.push(segment);
                        // add junction segments to snapped segment
                        segment.links.f.push(link);
                    }

                    links.push(segment);
                    segment.links.f.push(currentOther);
                    debugData.snaps ??= [];
                    debugData.snaps.push({
                        x: point.x,
                        y: point.y,
                    });

                    return true;
                };
            }
        }

        // intersection within radius check
        if (action.priority <= 2) {
            const { distance2, pointOnLine, lineProj2, length2 } =
                math.distanceToLine(segment.r.end, other.r.start, other.r.end);

            if (
                distance2 < snapDistance2 &&
                lineProj2 >= 0 &&
                lineProj2 <= length2
            ) {
                const currentOther = other;
                const point = pointOnLine;

                action.priority = 2;
                action.func = () => {
                    segment.r.setEnd(point);
                    segment.q.severed = true;

                    // if intersecting lines are too similar don't continue
                    if (
                        minDegreeDifference(currentOther.dir(), segment.dir()) <
                        config.mapGeneration.MINIMUM_INTERSECTION_DEVIATION
                    ) {
                        return false;
                    }

                    currentOther.split(point, segment, segments, qTree);
                    debugData.intersectionsRadius ??= [];
                    debugData.intersectionsRadius.push({
                        x: point.x,
                        y: point.y,
                    });

                    return true;
                };
            }
        }
    }

    if (action.func != null) {
        return action.func();
    }

    return true;
}

function createBranchTemplate(previousSegment: Segment) {
    const template = (
        direction: number,
        length: number,
        t: number,
        q: SegmentMeta,
    ) => {
        return createSegmentUsingDirection(
            previousSegment.r.end,
            direction,
            length,
            t,
            q,
        );
    };

    return {
        // used for highways or going straight on a normal branch
        continue(direction: number) {
            return template(
                direction,
                previousSegment.length(),
                0,
                previousSegment.q,
            );
        },

        // not using q, i.e. not highways
        branch(direction: number) {
            return template(
                direction,
                config.mapGeneration.DEFAULT_SEGMENT_LENGTH,
                previousSegment.q.highway
                    ? config.mapGeneration.NORMAL_BRANCH_TIME_DELAY_FROM_HIGHWAY
                    : 0,
                {},
            );
        },
    };
}

function generateBranches(previousSegment: Segment) {
    const newBranches: Segment[] = [];

    if (!previousSegment.q.severed) {
        const template = createBranchTemplate(previousSegment);
        const continueStraight = template.continue(previousSegment.dir());
        const straightPop = populationHeatmap.popOnRoad(continueStraight.r);

        if (previousSegment.q.highway) {
            const randomStraight = template.continue(
                previousSegment.dir() +
                    config.mapGeneration.RANDOM_STRAIGHT_ANGLE(),
            );
            const randomPop = populationHeatmap.popOnRoad(randomStraight.r);
            let roadPop: number;

            if (randomPop > straightPop) {
                newBranches.push(randomStraight);
                roadPop = randomPop;
            } else {
                newBranches.push(continueStraight);
                roadPop = straightPop;
            }

            if (
                roadPop >
                config.mapGeneration.HIGHWAY_BRANCH_POPULATION_THRESHOLD
            ) {
                const leftRoll = Math.random();
                if (
                    leftRoll < config.mapGeneration.HIGHWAY_BRANCH_PROBABILITY
                ) {
                    const leftHighwayBranch = template.continue(
                        previousSegment.dir() -
                            90 +
                            config.mapGeneration.RANDOM_BRANCH_ANGLE(),
                    );
                    newBranches.push(leftHighwayBranch);
                } else {
                    const rightRoll = Math.random();
                    if (
                        rightRoll <
                        config.mapGeneration.HIGHWAY_BRANCH_PROBABILITY
                    ) {
                        const rightHighwayBranch = template.continue(
                            previousSegment.dir() +
                                90 +
                                config.mapGeneration.RANDOM_BRANCH_ANGLE(),
                        );
                        newBranches.push(rightHighwayBranch);
                    }
                }
            }
        } else if (
            straightPop >
            config.mapGeneration.NORMAL_BRANCH_POPULATION_THRESHOLD
        ) {
            newBranches.push(continueStraight);
        }

        if (
            straightPop >
            config.mapGeneration.NORMAL_BRANCH_POPULATION_THRESHOLD
        ) {
            const leftRoll = Math.random();
            if (leftRoll < config.mapGeneration.DEFAULT_BRANCH_PROBABILITY) {
                const leftBranch = template.branch(
                    previousSegment.dir() -
                        90 +
                        config.mapGeneration.RANDOM_BRANCH_ANGLE(),
                );
                newBranches.push(leftBranch);
            } else {
                const rightRoll = Math.random();
                if (
                    rightRoll < config.mapGeneration.DEFAULT_BRANCH_PROBABILITY
                ) {
                    const rightBranch = template.branch(
                        previousSegment.dir() +
                            90 +
                            config.mapGeneration.RANDOM_BRANCH_ANGLE(),
                    );
                    newBranches.push(rightBranch);
                }
            }
        }
    }

    for (const branch of newBranches) {
        branch.previousSegmentToLink = previousSegment;
    }

    return newBranches;
}

export interface CityData {
    segments: Segment[];
    buildings: Building[];
    qTree: SegmentQuadtree;
    heatmap: PopulationHeatmap;
    debugData: DebugData;
}

export function generateCity(
    seed: number,
    options: {
        segmentCountLimit?: number;
    } = {},
): CityData {
    const debugData: DebugData = {};
    const segmentCountLimit =
        options.segmentCountLimit ?? config.mapGeneration.SEGMENT_COUNT_LIMIT;

    seedrandom(String(seed), { global: true });
    // this perlin noise library only supports 65536 different seeds
    seedPopulationHeatmap(Math.random());

    const priorityQ: Segment[] = [];

    // setup first segments in queue
    const rootSegment = new Segment(
        { x: 0, y: 0 },
        { x: config.mapGeneration.HIGHWAY_SEGMENT_LENGTH, y: 0 },
        0,
        {
            highway: true,
        },
    );
    const oppositeDirection = cloneSegment(rootSegment);
    const newEnd = {
        x: rootSegment.r.start.x - config.mapGeneration.HIGHWAY_SEGMENT_LENGTH,
        y: oppositeDirection.r.end.y,
    };
    oppositeDirection.r.setEnd(newEnd);
    oppositeDirection.links.b.push(rootSegment);
    rootSegment.links.b.push(oppositeDirection);
    priorityQ.push(rootSegment);
    priorityQ.push(oppositeDirection);

    const segments: Segment[] = [];
    const qTree = new Quadtree(
        config.mapGeneration.QUADTREE_PARAMS,
        config.mapGeneration.QUADTREE_MAX_OBJECTS,
        config.mapGeneration.QUADTREE_MAX_LEVELS,
    ) as SegmentQuadtree;

    while (priorityQ.length > 0 && segments.length < segmentCountLimit) {
        // pop smallest r(ti, ri, qi) from Q (i.e., smallest ‘t’)
        let minT: number | null = null;
        let minTIndex = 0;

        for (const [index, segment] of priorityQ.entries()) {
            if (minT == null || segment.t < minT) {
                minT = segment.t;
                minTIndex = index;
            }
        }

        const minSegment = priorityQ.splice(minTIndex, 1)[0];
        const accepted = localConstraints(
            minSegment,
            segments,
            qTree,
            debugData,
        );

        if (accepted) {
            minSegment.setupBranchLinks();

            insertSegment(minSegment, segments, qTree);

            for (const newSegment of generateBranches(minSegment)) {
                newSegment.t = minSegment.t + 1 + newSegment.t;
                priorityQ.push(newSegment);
            }
        }
    }

    const buildings = generateBuildings(segments);

    console.log(`${segments.length} segments generated.`);

    return {
        segments,
        buildings,
        qTree,
        heatmap: populationHeatmap,
        debugData,
    };
}

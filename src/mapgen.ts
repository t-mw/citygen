import Quadtree from "@timohausmann/quadtree-js";
import noisejs from "noisejs";
import seedrandom from "seedrandom";

import { CollisionObject, type CollisionLimits } from "./collision";
import math, { type Point } from "./math";

import build from "./build";
import config from "./config";

const noise = new noisejs.Noise();

enum SegmentEnd {
    Start,
    End,
}

interface Road {
    start: Point;
    end: Point;
    setStart(point: Point): void;
    setEnd(point: Point): void;
}

interface SegmentMeta {
    highway?: boolean;
    severed?: boolean;
    color?: number;
}

interface SegmentLinks {
    b: Segment[];
    f: Segment[];
}

interface DebugData {
    intersections?: Point[];
    snaps?: Point[];
    intersectionsRadius?: Point[];
}

type SegmentQuadtree = Quadtree<CollisionLimits<Segment>>;

type RoadIntersection = false | { x: number; y: number; t: number };

function minDegreeDifference(d1: number, d2: number) {
    const diff = Math.abs(d1 - d2) % 180;
    return Math.min(diff, Math.abs(diff - 180));
}

function getCollisionLimits<T>(
    collider: CollisionObject<T>,
): CollisionLimits<T> {
    return collider.limits();
}

export class Segment {
    width: number;
    collider: CollisionObject<Segment>;
    roadRevision: number;
    dirRevision: number | undefined;
    lengthRevision: number | undefined;
    cachedDir: number | undefined;
    cachedLength: number | undefined;
    r: Road;
    t: number;
    q: SegmentMeta;
    links: SegmentLinks;
    users: unknown[];
    maxSpeed: number;
    capacity: number;
    previousSegmentToLink: Segment | undefined;
    id: number | undefined;

    constructor(start: Point, end: Point, t = 0, q: SegmentMeta = {}) {
        const startCopy = { ...start };
        const endCopy = { ...end };
        const resolvedQ = { ...q };

        this.width = resolvedQ.highway
            ? config.mapGeneration.HIGHWAY_SEGMENT_WIDTH
            : config.mapGeneration.DEFAULT_SEGMENT_WIDTH;
        this.collider = new CollisionObject(this, {
            type: "line",
            start: startCopy,
            end: endCopy,
            width: this.width,
        });

        this.roadRevision = 0;
        this.dirRevision = undefined;
        this.lengthRevision = undefined;
        this.cachedDir = undefined;
        this.cachedLength = undefined;

        // representation of road
        this.r = {
            start: startCopy,
            end: endCopy,
            setStart: (point: Point) => {
                this.r.start = point;
                this.collider.setCollision({
                    type: "line",
                    start: this.r.start,
                    end: this.r.end,
                    width: this.width,
                });
                this.roadRevision += 1;
            },
            setEnd: (point: Point) => {
                this.r.end = point;
                this.collider.setCollision({
                    type: "line",
                    start: this.r.start,
                    end: this.r.end,
                    width: this.width,
                });
                this.roadRevision += 1;
            },
        };

        // time-step delay before this road is evaluated
        this.t = t;
        // meta-information relevant to global goals
        this.q = resolvedQ;
        // links backwards and forwards
        this.links = {
            b: [],
            f: [],
        };
        this.users = [];
        this.previousSegmentToLink = undefined;
        this.id = undefined;

        if (resolvedQ.highway) {
            this.maxSpeed = 1200;
            this.capacity = 12;
        } else {
            this.maxSpeed = 800;
            this.capacity = 6;
        }
    }

    currentSpeed() {
        // subtract 1 from users length so that a single user can go full speed
        return (
            Math.min(
                config.gameLogic.MIN_SPEED_PROPORTION,
                1 - Math.max(0, this.users.length - 1) / this.capacity,
            ) * this.maxSpeed
        );
    }

    // clockwise direction
    dir() {
        if (this.dirRevision !== this.roadRevision) {
            this.dirRevision = this.roadRevision;
            const vector = math.subtractPoints(this.r.end, this.r.start);
            this.cachedDir =
                -1 *
                math.sign(math.crossProduct({ x: 0, y: 1 }, vector)) *
                math.angleBetween({ x: 0, y: 1 }, vector);
        }

        if (this.cachedDir == null) {
            throw new Error("Expected cached direction");
        }

        return this.cachedDir;
    }

    length() {
        if (this.lengthRevision !== this.roadRevision) {
            this.lengthRevision = this.roadRevision;
            this.cachedLength = math.length(this.r.start, this.r.end);
        }

        if (this.cachedLength == null) {
            throw new Error("Expected cached length");
        }

        return this.cachedLength;
    }

    debugLinks() {
        this.q.color = 0x00ff00;

        for (const backwards of this.links.b) {
            backwards.q.color = 0xff0000;
        }

        for (const forwards of this.links.f) {
            forwards.q.color = 0x0000ff;
        }
    }

    startIsBackwards() {
        if (this.links.b.length > 0) {
            return (
                math.equalV(this.links.b[0].r.start, this.r.start) ||
                math.equalV(this.links.b[0].r.end, this.r.start)
            );
        }

        return (
            math.equalV(this.links.f[0].r.start, this.r.end) ||
            math.equalV(this.links.f[0].r.end, this.r.end)
        );
    }

    cost() {
        return this.length() / this.currentSpeed();
    }

    costTo(other: Segment, fromFraction: number | null = null) {
        const segmentEnd = this.endContaining(other);

        if (fromFraction != null) {
            switch (segmentEnd) {
                case SegmentEnd.Start:
                    return this.cost() * fromFraction;
                case SegmentEnd.End:
                    return this.cost() * (1 - fromFraction);
            }
        }

        return this.cost() * 0.5;
    }

    neighbours() {
        return this.links.f.concat(this.links.b);
    }

    endContaining(segment: Segment): SegmentEnd | undefined {
        const startBackwards = this.startIsBackwards();

        if (this.links.b.includes(segment)) {
            return startBackwards ? SegmentEnd.Start : SegmentEnd.End;
        }

        if (this.links.f.includes(segment)) {
            return startBackwards ? SegmentEnd.End : SegmentEnd.Start;
        }

        return undefined;
    }

    linksForEndContaining(segment: Segment) {
        if (this.links.b.includes(segment)) {
            return this.links.b;
        }

        if (this.links.f.includes(segment)) {
            return this.links.f;
        }

        return undefined;
    }

    setupBranchLinks() {
        if (this.previousSegmentToLink == null) {
            return;
        }

        // setup links between each current branch and each existing branch stemming from the previous segment
        for (const link of this.previousSegmentToLink.links.f) {
            this.links.b.push(link);
            const endLinks = link.linksForEndContaining(
                this.previousSegmentToLink,
            );
            if (endLinks == null) {
                throw new Error("Expected previous segment links");
            }

            endLinks.push(this);
        }

        this.previousSegmentToLink.links.f.push(this);
        this.links.b.push(this.previousSegmentToLink);
    }

    split(
        point: Point,
        segment: Segment,
        segmentList: Segment[],
        qTree: SegmentQuadtree,
    ) {
        const startIsBackwards = this.startIsBackwards();

        const splitPart = segmentFactory.fromExisting(this);
        addSegment(splitPart, segmentList, qTree);
        splitPart.r.setEnd(point);
        this.r.setStart(point);

        // links are not copied using the preceding factory method
        // copy link array for the split part, keeping references the same
        splitPart.links.b = this.links.b.slice();
        splitPart.links.f = this.links.f.slice();

        // work out which links correspond to which end of the split segment
        if (startIsBackwards) {
            for (const link of splitPart.links.b) {
                const backwardIndex = link.links.b.indexOf(this);
                if (backwardIndex !== -1) {
                    link.links.b[backwardIndex] = splitPart;
                } else {
                    const forwardIndex = link.links.f.indexOf(this);
                    link.links.f[forwardIndex] = splitPart;
                }
            }

            splitPart.links.f = [segment, this];
            this.links.b = [segment, splitPart];

            segment.links.f.push(splitPart);
            segment.links.f.push(this);
            return;
        }

        for (const link of splitPart.links.f) {
            const backwardIndex = link.links.b.indexOf(this);
            if (backwardIndex !== -1) {
                link.links.b[backwardIndex] = splitPart;
            } else {
                const forwardIndex = link.links.f.indexOf(this);
                link.links.f[forwardIndex] = splitPart;
            }
        }

        this.links.f = [segment, splitPart];
        splitPart.links.b = [segment, this];

        segment.links.f.push(this);
        segment.links.f.push(splitPart);
    }
}

const segmentFactory = {
    fromExisting(
        segment: Segment,
        t: number | null = null,
        r: Road | null = null,
        q: SegmentMeta | null = null,
    ) {
        const resolvedT = t ?? segment.t;
        const resolvedR = r ?? segment.r;
        const resolvedQ = q == null ? { ...segment.q } : { ...q };
        return new Segment(
            resolvedR.start,
            resolvedR.end,
            resolvedT,
            resolvedQ,
        );
    },

    usingDirection(
        start: Point,
        dir: number | null = null,
        length: number | null = null,
        t: number | null = null,
        q: SegmentMeta | null = null,
    ) {
        // default to east
        const resolvedDir = dir ?? 90;
        const resolvedLength =
            length ?? config.mapGeneration.DEFAULT_SEGMENT_LENGTH;
        const end = {
            x: start.x + resolvedLength * math.sinDegrees(resolvedDir),
            y: start.y + resolvedLength * math.cosDegrees(resolvedDir),
        };
        return new Segment(start, end, t ?? 0, q ?? {});
    },
};

const heatmap = {
    popOnRoad(r: Road) {
        return (
            (this.populationAt(r.start.x, r.start.y) +
                this.populationAt(r.end.x, r.end.y)) /
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
    let closestIntersectionT: number | undefined;

    const matches = qTree.retrieve(getCollisionLimits(segment.collider));

    for (const match of matches) {
        const other = match.o;
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
            if (
                math.length(segment.r.end, other.r.end) <=
                config.mapGeneration.ROAD_SNAP_DISTANCE
            ) {
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
                distance2 <
                    config.mapGeneration.ROAD_SNAP_DISTANCE *
                        config.mapGeneration.ROAD_SNAP_DISTANCE &&
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

const globalGoals = {
    generate(previousSegment: Segment) {
        const newBranches: Segment[] = [];

        if (!previousSegment.q.severed) {
            const template = (
                direction: number,
                length: number,
                t: number,
                q: SegmentMeta,
            ) => {
                return segmentFactory.usingDirection(
                    previousSegment.r.end,
                    direction,
                    length,
                    t,
                    q,
                );
            };

            // used for highways or going straight on a normal branch
            const templateContinue = (direction: number) => {
                return template(
                    direction,
                    previousSegment.length(),
                    0,
                    previousSegment.q,
                );
            };
            // not using q, i.e. not highways
            const templateBranch = (direction: number) => {
                return template(
                    direction,
                    config.mapGeneration.DEFAULT_SEGMENT_LENGTH,
                    previousSegment.q.highway
                        ? config.mapGeneration
                              .NORMAL_BRANCH_TIME_DELAY_FROM_HIGHWAY
                        : 0,
                    {},
                );
            };

            const continueStraight = templateContinue(previousSegment.dir());
            const straightPop = heatmap.popOnRoad(continueStraight.r);

            if (previousSegment.q.highway) {
                const randomStraight = templateContinue(
                    previousSegment.dir() +
                        config.mapGeneration.RANDOM_STRAIGHT_ANGLE(),
                );
                const randomPop = heatmap.popOnRoad(randomStraight.r);
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
                        leftRoll <
                        config.mapGeneration.HIGHWAY_BRANCH_PROBABILITY
                    ) {
                        const leftHighwayBranch = templateContinue(
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
                            const rightHighwayBranch = templateContinue(
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
                if (
                    leftRoll < config.mapGeneration.DEFAULT_BRANCH_PROBABILITY
                ) {
                    const leftBranch = templateBranch(
                        previousSegment.dir() -
                            90 +
                            config.mapGeneration.RANDOM_BRANCH_ANGLE(),
                    );
                    newBranches.push(leftBranch);
                } else {
                    const rightRoll = Math.random();
                    if (
                        rightRoll <
                        config.mapGeneration.DEFAULT_BRANCH_PROBABILITY
                    ) {
                        const rightBranch = templateBranch(
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
    },
};

function addSegment(
    segment: Segment,
    segmentList: Segment[],
    qTree: SegmentQuadtree,
) {
    segmentList.push(segment);
    qTree.insert(getCollisionLimits(segment.collider));
}

function generate(seed: number) {
    const debugData: DebugData = {};

    seedrandom(String(seed), { global: true });
    // this perlin noise library only supports 65536 different seeds
    noise.seed(Math.random());

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
    const oppositeDirection = segmentFactory.fromExisting(rootSegment);
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

    while (
        priorityQ.length > 0 &&
        segments.length < config.mapGeneration.SEGMENT_COUNT_LIMIT
    ) {
        // pop smallest r(ti, ri, qi) from Q (i.e., smallest ‘t’)
        let minT: number | undefined;
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

            addSegment(minSegment, segments, qTree);

            for (const newSegment of globalGoals.generate(minSegment)) {
                newSegment.t = minSegment.t + 1 + newSegment.t;
                priorityQ.push(newSegment);
            }
        }
    }

    let id = 0;
    for (const segment of segments) {
        segment.id = id;
        id += 1;
    }

    const buildings = build.generateBuildings(segments);

    console.log(`${segments.length} segments generated.`);

    return {
        segments,
        buildings,
        qTree,
        heatmap,
        debugData,
    };
}

const mapgen = {
    Segment,
    generate,
};

export default mapgen;

import Quadtree from "@timohausmann/quadtree-js";

import { CollisionObject, type CollisionLimits } from "../collision";
import config from "../config";
import math, { type Point } from "../math";

export interface Road {
    start: Point;
    end: Point;
    setStart(point: Point): void;
    setEnd(point: Point): void;
}

export interface SegmentMeta {
    highway?: boolean;
    severed?: boolean;
    color?: number;
}

interface SegmentLinks {
    b: Segment[];
    f: Segment[];
}

export type SegmentQuadtree = Quadtree<CollisionLimits<Segment>>;

function getCollisionLimits<T>(
    collider: CollisionObject<T>,
): CollisionLimits<T> {
    return collider.limits();
}

export class Segment {
    width: number;
    collider: CollisionObject<Segment>;
    roadRevision: number;
    dirRevision: number | null;
    lengthRevision: number | null;
    cachedDir: number | null;
    cachedLength: number | null;
    r: Road;
    t: number;
    q: SegmentMeta;
    links: SegmentLinks;
    previousSegmentToLink: Segment | null;

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
        this.dirRevision = null;
        this.lengthRevision = null;
        this.cachedDir = null;
        this.cachedLength = null;

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
        this.previousSegmentToLink = null;
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

    pointAt(fraction: number) {
        return math.fractionBetween(this.r.start, this.r.end, fraction);
    }

    connectedAtStart(other: Segment) {
        const startBackwards = this.startIsBackwards();

        if (this.links.b.includes(other)) {
            return startBackwards;
        }

        if (this.links.f.includes(other)) {
            return !startBackwards;
        }

        throw new Error("Expected linked segment");
    }

    connectionPoint(other: Segment) {
        if (this.connectedAtStart(other)) {
            return this.r.start;
        }

        return this.r.end;
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

    linksForEndContaining(segment: Segment) {
        if (this.links.b.includes(segment)) {
            return this.links.b;
        }

        if (this.links.f.includes(segment)) {
            return this.links.f;
        }

        return null;
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

        const splitPart = cloneSegment(this);
        insertSegment(splitPart, segmentList, qTree);
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

export function cloneSegment(
    segment: Segment,
    t: number | null = null,
    r: Road | null = null,
    q: SegmentMeta | null = null,
) {
    const resolvedT = t ?? segment.t;
    const resolvedR = r ?? segment.r;
    const resolvedQ = q == null ? { ...segment.q } : { ...q };
    return new Segment(resolvedR.start, resolvedR.end, resolvedT, resolvedQ);
}

export function createSegmentUsingDirection(
    start: Point,
    dir = 90,
    length = config.mapGeneration.DEFAULT_SEGMENT_LENGTH,
    t = 0,
    q: SegmentMeta = {},
) {
    // default to east
    const end = {
        x: start.x + length * math.sinDegrees(dir),
        y: start.y + length * math.cosDegrees(dir),
    };
    return new Segment(start, end, t, q);
}

export function insertSegment(
    segment: Segment,
    segmentList: Segment[],
    qTree: SegmentQuadtree,
) {
    segmentList.push(segment);
    qTree.insert(getCollisionLimits(segment.collider));
}

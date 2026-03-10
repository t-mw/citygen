import math, { type Point } from "./math";

export interface RectCollision {
    type: "rect";
    corners: [Point, Point, Point, Point];
}

export interface LineCollision {
    type: "line";
    start: Point;
    end: Point;
    width: number;
}

export interface CircleCollision {
    type: "circle";
    center: Point;
    radius: number;
}

export type Collision = RectCollision | LineCollision | CircleCollision;

export interface CollisionLimits<T> {
    x: number;
    y: number;
    width: number;
    height: number;
    o: T | undefined;
}

function getAxisExtremes(values: number[]) {
    let min = values[0];
    let max = values[0];
    let minIndex = 0;
    let maxIndex = 0;

    for (const [index, value] of values.entries()) {
        if (value < min) {
            min = value;
            minIndex = index;
        }

        if (value > max) {
            max = value;
            maxIndex = index;
        }
    }

    return { min, max, minIndex, maxIndex };
}

export class CollisionObject<T = unknown> {
    o: T | undefined;
    collision: Collision;
    collisionRevision: number;
    limitsRevision: number | undefined;
    cachedLimits: CollisionLimits<T> | undefined;

    constructor(o: T | undefined, collision: Collision) {
        this.o = o;
        this.collision = collision;
        this.collisionRevision = 0;
        this.limitsRevision = undefined;
        this.cachedLimits = undefined;
    }

    setCollision(collision: Collision) {
        this.collisionRevision += 1;
        this.collision = collision;
    }

    limits(): CollisionLimits<T> {
        if (this.collisionRevision !== this.limitsRevision) {
            this.limitsRevision = this.collisionRevision;

            switch (this.collision.type) {
                case "rect": {
                    const xs = this.collision.corners.map((corner) => corner.x);
                    const ys = this.collision.corners.map((corner) => corner.y);
                    const minX = Math.min(...xs);
                    const minY = Math.min(...ys);
                    this.cachedLimits = {
                        x: minX,
                        y: minY,
                        width: Math.max(...xs) - minX,
                        height: Math.max(...ys) - minY,
                        o: this.o,
                    };
                    break;
                }

                case "line":
                    this.cachedLimits = {
                        x: Math.min(
                            this.collision.start.x,
                            this.collision.end.x,
                        ),
                        y: Math.min(
                            this.collision.start.y,
                            this.collision.end.y,
                        ),
                        width: Math.abs(
                            this.collision.start.x - this.collision.end.x,
                        ),
                        height: Math.abs(
                            this.collision.start.y - this.collision.end.y,
                        ),
                        o: this.o,
                    };
                    break;

                case "circle":
                    this.cachedLimits = {
                        x: this.collision.center.x - this.collision.radius,
                        y: this.collision.center.y - this.collision.radius,
                        width: this.collision.radius * 2,
                        height: this.collision.radius * 2,
                        o: this.o,
                    };
                    break;
            }
        }

        if (this.cachedLimits == null) {
            throw new Error("Expected cached collision limits");
        }

        return this.cachedLimits;
    }

    collide(other: CollisionObject): Point | boolean | undefined {
        // avoid expensive collision check if possible
        const objLimits = this.limits();
        const otherLimits = other.limits();

        if (
            objLimits.x + objLimits.width < otherLimits.x ||
            otherLimits.x + otherLimits.width < objLimits.x ||
            objLimits.y + objLimits.height < otherLimits.y ||
            otherLimits.y + otherLimits.height < objLimits.y
        ) {
            return false;
        }

        switch (this.collision.type) {
            case "circle":
                if (other.collision.type === "rect") {
                    return this.rectCircleCollision(
                        other.collision,
                        this.collision,
                    );
                }
                break;

            case "rect":
                switch (other.collision.type) {
                    case "rect":
                        return this.rectRectIntersection(
                            this.collision,
                            other.collision,
                        );
                    case "line":
                        return this.rectRectIntersection(
                            this.collision,
                            this.rectCollisionFromLine(other.collision),
                        );
                    case "circle":
                        return this.rectCircleCollision(
                            this.collision,
                            other.collision,
                        );
                }
                break;

            case "line":
                switch (other.collision.type) {
                    case "rect":
                        return this.rectRectIntersection(
                            this.rectCollisionFromLine(this.collision),
                            other.collision,
                        );
                    case "line":
                        return this.rectRectIntersection(
                            this.rectCollisionFromLine(this.collision),
                            this.rectCollisionFromLine(other.collision),
                        );
                }
                break;
        }

        return undefined;
    }

    rectCircleCollision(
        rectCollision: RectCollision,
        circleCollision: CircleCollision,
    ) {
        const corners = rectCollision.corners;

        // check for corner intersections with circle
        for (const corner of corners) {
            if (
                math.length2(corner, circleCollision.center) <=
                circleCollision.radius * circleCollision.radius
            ) {
                return true;
            }
        }

        // check for edge intersections with circle
        // from http://stackoverflow.com/a/1079478
        for (const [index, start] of corners.entries()) {
            const end = corners[(index + 1) % corners.length];
            const { distance2, lineProj2, length2 } = math.distanceToLine(
                circleCollision.center,
                start,
                end,
            );

            if (
                lineProj2 > 0 &&
                lineProj2 < length2 &&
                distance2 <= circleCollision.radius * circleCollision.radius
            ) {
                return true;
            }
        }

        // check that circle is not enclosed by rectangle
        const axes = [
            math.subtractPoints(corners[3], corners[0]),
            math.subtractPoints(corners[3], corners[2]),
        ];

        const projections = [
            math.project(
                math.subtractPoints(circleCollision.center, corners[0]),
                axes[0],
            ),
            math.project(
                math.subtractPoints(circleCollision.center, corners[2]),
                axes[1],
            ),
        ];

        if (
            projections[0].dotProduct < 0 ||
            math.lengthV2(projections[0].projected) > math.lengthV2(axes[0]) ||
            projections[1].dotProduct < 0 ||
            math.lengthV2(projections[1].projected) > math.lengthV2(axes[1])
        ) {
            return false;
        }

        return true;
    }

    rectCollisionFromLine(lineCollision: LineCollision): RectCollision {
        const dir = math.subtractPoints(lineCollision.end, lineCollision.start);
        const perpDir = { x: -dir.y, y: dir.x };
        const halfWidthPerpDir = math.multVScalar(
            perpDir,
            (0.5 * lineCollision.width) / math.lengthV(perpDir),
        );

        return {
            type: "rect",
            corners: [
                math.addPoints(lineCollision.start, halfWidthPerpDir),
                math.subtractPoints(lineCollision.start, halfWidthPerpDir),
                math.subtractPoints(lineCollision.end, halfWidthPerpDir),
                math.addPoints(lineCollision.end, halfWidthPerpDir),
            ],
        };
    }

    rectRectIntersection(
        rectACollision: RectCollision,
        rectBCollision: RectCollision,
    ): Point | false {
        const cA = rectACollision.corners;
        const cB = rectBCollision.corners;

        const axes = [
            math.subtractPoints(cA[3], cA[0]),
            math.subtractPoints(cA[3], cA[2]),
            math.subtractPoints(cB[0], cB[1]),
            math.subtractPoints(cB[0], cB[3]),
        ];

        // list used to find axis with the minimum overlap
        // that axis is used as the response translation vector
        const axisOverlaps: Point[] = [];

        for (const axis of axes) {
            // project rectangle points to axis
            const projectedVectorsA = cA.map(
                (corner) => math.project(corner, axis).projected,
            );
            const projectedVectorsB = cB.map(
                (corner) => math.project(corner, axis).projected,
            );

            // calculate relative positions of rectangles on axis
            const positionsOnAxisA = projectedVectorsA.map((vector) =>
                math.dotProduct(vector, axis),
            );
            const positionsOnAxisB = projectedVectorsB.map((vector) =>
                math.dotProduct(vector, axis),
            );

            const axisA = getAxisExtremes(positionsOnAxisA);
            const axisB = getAxisExtremes(positionsOnAxisB);

            // if the rectangles don't overlap on at least one axis
            // they are not colliding
            if (axisA.max < axisB.min || axisB.max < axisA.min) {
                return false;
            }

            // calculate the overlap between the rectangles on this axis
            const diff1 = math.subtractPoints(
                projectedVectorsA[axisA.maxIndex],
                projectedVectorsB[axisB.minIndex],
            );
            const diff2 = math.subtractPoints(
                projectedVectorsB[axisB.maxIndex],
                projectedVectorsA[axisA.minIndex],
            );

            if (math.lengthV2(diff1) < math.lengthV2(diff2)) {
                axisOverlaps.push(diff1);
            } else {
                // the rectangles overlap on the other side
                // invert the vector so that it will push out of the collision
                axisOverlaps.push(math.multVScalar(diff2, -1));
            }
        }

        // find axis with the minimum overlap
        let minVector = axisOverlaps[0];
        for (const axisOverlap of axisOverlaps.slice(1)) {
            if (math.lengthV2(axisOverlap) < math.lengthV2(minVector)) {
                minVector = axisOverlap;
            }
        }

        // return displacement required to pull rectA from collision
        return math.multVScalar(minVector, -1);
    }
}

const collision = {
    CollisionObject,
};

export default collision;

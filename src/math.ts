const Epsilon = 0.00000001;

export interface Point {
    x: number;
    y: number;
}

const math = {
    // https://github.com/pgkelley4/line-segments-intersect/blob/master/js/line-segments-intersect.js
    doLineSegmentsIntersect(
        p: Point,
        p2: Point,
        q: Point,
        q2: Point,
        omitEnds = false,
    ) {
        const r = math.subtractPoints(p2, p);
        const s = math.subtractPoints(q2, q);

        const uNumerator = math.crossProduct(math.subtractPoints(q, p), r);
        const denominator = math.crossProduct(r, s);

        if (uNumerator === 0 && denominator === 0) {
            return false;
        }

        if (denominator === 0) {
            // lines are paralell
            return false;
        }

        const u = uNumerator / denominator;
        const t = math.crossProduct(math.subtractPoints(q, p), s) / denominator;

        let doSegmentsIntersect;
        if (!omitEnds) {
            doSegmentsIntersect = t >= 0 && t <= 1 && u >= 0 && u <= 1;
        } else {
            doSegmentsIntersect =
                t > 0.001 && t < 1 - 0.001 && u > 0.001 && u < 1 - 0.001;
        }

        if (doSegmentsIntersect) {
            return { x: p.x + t * r.x, y: p.y + t * r.y, t };
        }

        return doSegmentsIntersect;
    },

    equalV(v1: Point, v2: Point) {
        const diff = math.subtractPoints(v1, v2);
        return math.lengthV2(diff) < Epsilon;
    },

    addPoints(point1: Point, point2: Point) {
        return {
            x: point1.x + point2.x,
            y: point1.y + point2.y,
        };
    },

    subtractPoints(point1: Point, point2: Point) {
        return {
            x: point1.x - point2.x,
            y: point1.y - point2.y,
        };
    },

    crossProduct(point1: Point, point2: Point) {
        return point1.x * point2.y - point1.y * point2.x;
    },

    dotProduct(point1: Point, point2: Point) {
        return point1.x * point2.x + point1.y * point2.y;
    },

    length(point1: Point, point2: Point) {
        return math.lengthV(math.subtractPoints(point2, point1));
    },

    length2(point1: Point, point2: Point) {
        return math.lengthV2(math.subtractPoints(point2, point1));
    },

    lengthV(v: Point) {
        return Math.sqrt(math.lengthV2(v));
    },

    lengthV2(v: Point) {
        return v.x * v.x + v.y * v.y;
    },

    angleBetween(v1: Point, v2: Point) {
        const angleRad = Math.acos(
            (v1.x * v2.x + v1.y * v2.y) / (math.lengthV(v1) * math.lengthV(v2)),
        );
        return (angleRad * 180) / Math.PI;
    },

    sign(x: number) {
        if (x > 0) {
            return 1;
        }

        if (x < 0) {
            return -1;
        }

        return 0;
    },

    fractionBetween(v1: Point, v2: Point, fraction: number) {
        const v1ToV2 = math.subtractPoints(v2, v1);
        return { x: v1.x + v1ToV2.x * fraction, y: v1.y + v1ToV2.y * fraction };
    },

    sinDegrees(deg: number) {
        return Math.sin((deg * Math.PI) / 180);
    },

    cosDegrees(deg: number) {
        return Math.cos((deg * Math.PI) / 180);
    },

    atanDegrees(val: number) {
        return (Math.atan(val) * 180) / Math.PI;
    },

    randomRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
    },

    multVScalar(v: Point, n: number) {
        return { x: v.x * n, y: v.y * n };
    },

    distanceToLine(P: Point, A: Point, B: Point) {
        const AP = math.subtractPoints(P, A);
        const AB = math.subtractPoints(B, A);
        const result = math.project(AP, AB);
        const AD = result.projected;
        const D = math.addPoints(A, AD);

        return {
            distance2: math.length2(D, P),
            pointOnLine: D,
            // distance along line of projected point
            lineProj2: math.sign(result.dotProduct) * math.lengthV2(AD),
            length2: math.lengthV2(AB),
        };
    },

    project(v: Point, onto: Point) {
        // http://en.wikipedia.org/wiki/Vector_projection
        const dotProduct = math.dotProduct(v, onto);
        return {
            dotProduct,
            projected: math.multVScalar(onto, dotProduct / math.lengthV2(onto)),
        };
    },
};

export default math;

var Epsilon = 0.00000001;

module.exports = {
  /**
   * @author Peter Kelley
   * @author pgkelley4@gmail.com
   */

  /**
   * See if two line segments intersect. This uses the
   * vector cross product approach described below:
   * http://stackoverflow.com/a/565282/786339
   *
   * @param {Object} p point object with x and y coordinates
   *  representing the start of the 1st line.
   * @param {Object} p2 point object with x and y coordinates
   *  representing the end of the 1st line.
   * @param {Object} q point object with x and y coordinates
   *  representing the start of the 2nd line.
   * @param {Object} q2 point object with x and y coordinates
   *  representing the end of the 2nd line.
   */
  doLineSegmentsIntersect: function (p, p2, q, q2, omitEnds) {
    var r = this.subtractPoints(p2, p);
    var s = this.subtractPoints(q2, q);

    var uNumerator = this.crossProduct(this.subtractPoints(q, p), r);
    var denominator = this.crossProduct(r, s);

    if (uNumerator == 0 && denominator == 0) {
      return false;
      // colinear, so do they overlap?
      // return ((q.x - p.x < 0) != (q.x - p2.x < 0) != (q2.x - p.x < 0) != (q2.x - p2.x < 0)) ||
      //   ((q.y - p.y < 0) != (q.y - p2.y < 0) != (q2.y - p.y < 0) != (q2.y - p2.y < 0));
    }

    if (denominator == 0) {
      // lines are paralell
      return false;
    }

    var u = uNumerator / denominator;
    var t = this.crossProduct(this.subtractPoints(q, p), s) / denominator;

    var doSegmentsIntersect;
    if (!omitEnds) {
      doSegmentsIntersect = (t >= 0) && (t <= 1) && (u >= 0) && (u <= 1);
    } else {
       doSegmentsIntersect = (t > 0.001) && (t < 1-0.001) && (u > 0.001) && (u < 1-0.001);
    }

    if (doSegmentsIntersect) {
      return { x: p.x + t * r.x, y: p.y + t * r.y, t: t }
    }

    return doSegmentsIntersect;
  },

  equalV: function(v1, v2) {
    var diff = this.subtractPoints(v1, v2);
    var length2 = this.lengthV2(diff);
    return length2 < Epsilon;
  },

  addPoints: function(point1, point2) {
    var result = {};
    result.x = point1.x + point2.x;
    result.y = point1.y + point2.y;

    return result;
  },

  subtractPoints: function (point1, point2) {
    return {
      x: point1.x - point2.x,
      y: point1.y - point2.y
    }
  },

  crossProduct: function (point1, point2) {
    return point1.x * point2.y - point1.y * point2.x;
  },

  dotProduct: function(point1, point2) {
    return point1.x * point2.x + point1.y * point2.y;
  },

  length: function (point1, point2) {
    var v = this.subtractPoints(point2, point1);
    return this.lengthV(v);
  },

  length2: function (point1, point2) {
    var v = this.subtractPoints(point2, point1);
    return this.lengthV2(v);
  },

  lengthV: function(v) {
    return Math.sqrt(this.lengthV2(v));
  },

  lengthV2: function(v) {
    return v.x * v.x + v.y * v.y;
  },

  angleBetween: function(v1, v2) {
    angleRad = Math.acos( (v1.x * v2.x + v1.y * v2.y) /
      ( this.lengthV(v1) * this.lengthV(v2) ) );
    angleDeg = angleRad * 180 / Math.PI;
    return angleDeg;
  },

  sign: function(x) {
    if (x > 0) {
      return 1;
    } else if (x < 0) {
      return -1;
    } else {
      return 0;
    }
  },

  fractionBetween: function (v1, v2, fraction) {
    var v1ToV2 = this.subtractPoints(v2, v1);
    return {x: (v1.x + v1ToV2.x * fraction), y: (v1.y + v1ToV2.y * fraction)}
  },

  sinDegrees: function(deg) {
    return Math.sin(deg * Math.PI / 180);
  },

  cosDegrees: function(deg) {
    return Math.cos(deg * Math.PI / 180);
  },

  atanDegrees: function(val) {
    return Math.atan(val) * 180 / Math.PI;
  },

  randomRange: function(min, max) {
    return Math.random()*(max - min) + min;
  },

  multVScalar: function(v, n) {
    return {x: v.x * n, y: v.y * n};
  },

  divVScalar: function(v, n) {
    return {x: v.x / n, y: v.y / n};
  },

  oldDistanceToLine: function(p, q1, q2) {
    // https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
    var qV = this.subtractPoints(q2, q1);
    var length = this.lengthV(qV);
    var qVNorm = this.divVScalar(qV, length);

    var eq2 = this.dotProduct(this.subtractPoints(q1, p), qVNorm);
    var qVNormMult = this.multVScalar(qVNorm, eq2);
    var vToLine = this.subtractPoints(this.subtractPoints(q1, p), qVNormMult);

    return {
      distance: this.lengthV(vToLine),
      pointOnLine: this.addPoints(p, vToLine),
      // distance along line of projected point
      lineProj: -eq2,
      length: length
    };
  },

  newDistanceToLine: function(P, A, B) {
    var AP = this.subtractPoints(P, A);
    var AB = this.subtractPoints(B, A);
    var result = this.project(AP, AB);
    var AD = result.projected;
    var D = this.addPoints(A, AD);

    return {
      distance: this.length(D, P),
      pointOnLine: D,
      // distance along line of projected point
      lineProj: this.sign(result.dotProduct) * this.lengthV(AD) ,
      length: this.lengthV(AB)
    };
  },

  distanceToLine: function(P, A, B) {
    var AP = this.subtractPoints(P, A);
    var AB = this.subtractPoints(B, A);
    var result = this.project(AP, AB);
    var AD = result.projected;
    var D = this.addPoints(A, AD);

    return {
      distance2: this.length2(D, P),
      pointOnLine: D,
      // distance along line of projected point
      lineProj2: this.sign(result.dotProduct) * this.lengthV2(AD) ,
      length2: this.lengthV2(AB)
    };
  },

  project: function(v, onto) {
    // http://en.wikipedia.org/wiki/Vector_projection
    var dotProduct = this.dotProduct(v, onto);
    return {
      dotProduct: dotProduct,
      projected: this.multVScalar(onto, dotProduct / this.lengthV2(onto))
    }
  }
};


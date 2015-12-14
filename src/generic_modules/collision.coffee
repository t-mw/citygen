# author: tmwhere.com

_ = require('lodash')

math = require('generic_modules/math')
util = require('generic_modules/utility')

module.exports =
  CollisionObject:
    class CollisionObject
      @Type:
        RECT: "rect"
        LINE: "line"
        CIRCLE: "circle"

      constructor: (@o, @collisionType, @collisionProperties) ->
        @collisionRevision = 0
        @limitsRevision = undefined

        @cachedLimits = undefined

      updateCollisionProperties: (props) ->
        @collisionRevision++
        @collisionProperties = _.assign(@collisionProperties, props)

      limits: ->
        if (@collisionRevision != @limitsRevision)
          @limitsRevision = @collisionRevision
          @cachedLimits = switch @collisionType
            when CollisionObject.Type.RECT
              minX = _.min(@collisionProperties.corners, 'x').x
              minY = _.min(@collisionProperties.corners, 'y').y
              @cachedLimits =
                x: minX
                y: minY
                width: _.max(@collisionProperties.corners, 'x').x - minX
                height: _.max(@collisionProperties.corners, 'y').y - minY
                o: @o
            when CollisionObject.Type.LINE
              x: Math.min(@collisionProperties.start.x, @collisionProperties.end.x)
              y: Math.min(@collisionProperties.start.y, @collisionProperties.end.y)
              width: Math.abs(@collisionProperties.start.x - @collisionProperties.end.x)
              height: Math.abs(@collisionProperties.start.y - @collisionProperties.end.y)
              o: @o
            when CollisionObject.Type.CIRCLE
              x: @collisionProperties.center.x - @collisionProperties.radius
              y: @collisionProperties.center.y - @collisionProperties.radius
              width: @collisionProperties.radius * 2
              height: @collisionProperties.radius * 2
              o: @o

        return @cachedLimits

      collide: (other) ->
        # avoid expensive collision check if possible
        objLimits = @limits()
        otherLimits = other.limits()
        if (objLimits? && otherLimits? &&
        (objLimits.x + objLimits.width < otherLimits.x || otherLimits.x + otherLimits.width < objLimits.x) &&
        (objLimits.y + objLimits.height < otherLimits.y || otherLimits.y + otherLimits.height < objLimits.y))
          return false

        switch @collisionType
          when CollisionObject.Type.CIRCLE
            switch other.collisionType
              when CollisionObject.Type.RECT
                @rectCircleCollision(other.collisionProperties, @collisionProperties)
          when CollisionObject.Type.RECT
            switch other.collisionType
              when CollisionObject.Type.RECT
                @rectRectIntersection(@collisionProperties, other.collisionProperties)
              when CollisionObject.Type.LINE
                @rectRectIntersection(@collisionProperties, @rectPropsFromLine(other.collisionProperties))
              when CollisionObject.Type.CIRCLE
                @rectCircleCollision(@collisionProperties, other.collisionProperties)
          when CollisionObject.Type.LINE
            switch other.collisionType
              when CollisionObject.Type.RECT
                @rectRectIntersection(@rectPropsFromLine(@collisionProperties), other.collisionProperties)
              when CollisionObject.Type.LINE
                @rectRectIntersection(@rectPropsFromLine(@collisionProperties), @rectPropsFromLine(other.collisionProperties))

      rectCircleCollision: (rectProps, circleProps) ->
        corners = rectProps.corners

        # check for corner intersections with circle
        for i in [0...corners.length] by 1
          if (math.length2(corners[i], circleProps.center) <= circleProps.radius * circleProps.radius)
            return true

        # check for edge intersections with circle
        # from http://stackoverflow.com/a/1079478
        for i in [0...corners.length] by 1
          start = corners[i]
          end = corners[(i + 1) % corners.length]
          {distance2, lineProj2, length2} = math.distanceToLine(circleProps.center, start, end)
          if (lineProj2 > 0 && lineProj2 < length2 && distance2 <= circleProps.radius * circleProps.radius)
            return true

        # check that circle is not enclosed by rectangle
        axes = [
          math.subtractPoints(corners[3], corners[0])
          math.subtractPoints(corners[3], corners[2])
        ]

        projections = [
          math.project(math.subtractPoints(circleProps.center, corners[0]), axes[0])
          math.project(math.subtractPoints(circleProps.center, corners[2]), axes[1])
        ]

        if (projections[0].dotProduct < 0 || math.lengthV2(projections[0].projected) > math.lengthV2(axes[0]) ||
        projections[1].dotProduct < 0 || math.lengthV2(projections[1].projected) > math.lengthV2(axes[1]))
          return false

        return true

      rectPropsFromLine: (lineProps) ->
        dir = math.subtractPoints(lineProps.end, lineProps.start)
        perpDir = {x: -dir.y, y: dir.x}
        halfWidthPerpDir = math.multVScalar(perpDir, 0.5 * lineProps.width / math.lengthV(perpDir))
        tempRectProps =
          corners: [
            math.addPoints(lineProps.start, halfWidthPerpDir),
            math.subtractPoints(lineProps.start, halfWidthPerpDir),
            math.subtractPoints(lineProps.end, halfWidthPerpDir),
            math.addPoints(lineProps.end, halfWidthPerpDir)
          ]

      rectRectIntersection: (rectAProps, rectBProps) ->

        cA = rectAProps.corners
        cB = rectBProps.corners
        # generate axes
        axes = [
          math.subtractPoints(cA[3], cA[0]),
          math.subtractPoints(cA[3], cA[2]),
          math.subtractPoints(cB[0], cB[1]),
          math.subtractPoints(cB[0], cB[3])
        ]

        # list used to find axis with the minimum overlap
        # that axis is used as the response translation vector
        axisOverlaps = []

        for axis in axes
          # project rectangle points to axis
          projectedVectorsA = []
          projectedVectorsB = []

          for corner in cA
            projectedVectorsA.push(math.project(corner, axis).projected)
          for corner in cB
            projectedVectorsB.push(math.project(corner, axis).projected)

          # calculate relative positions of rectangles on axis
          positionsOnAxisA = []
          positionsOnAxisB = []

          for v in projectedVectorsA
            positionsOnAxisA.push(math.dotProduct(v, axis))
          for v in projectedVectorsB
            positionsOnAxisB.push(math.dotProduct(v, axis))

          [maxA, maxA_i] = util.extendedMax(positionsOnAxisA)
          [minA, minA_i] = util.extendedMin(positionsOnAxisA)
          [maxB, maxB_i] = util.extendedMax(positionsOnAxisB)
          [minB, minB_i] = util.extendedMin(positionsOnAxisB)
          # if the rectangles don't overlap on at least one axis
          # they are not colliding
          if (maxA < minB || maxB < minA)
            return false
          else
            # calculate the overlap between the rectangles on this axis
            diff1 = math.subtractPoints(projectedVectorsA[maxA_i], projectedVectorsB[minB_i])
            diff2 = math.subtractPoints(projectedVectorsB[maxB_i], projectedVectorsA[minA_i])

            if (math.lengthV2(diff1) < math.lengthV2(diff2))
              axisOverlaps.push(diff1)
            else
              # the rectangles overlap on the other side
              # invert the vector so that it will push out of the collision
              axisOverlaps.push(math.multVScalar(diff2, -1))

        # find axis with the minimum overlap
        minVector = _.min(axisOverlaps, (v) ->
          math.lengthV2(v)
        )

        # return displacement required to pull rectA from collision
        return math.multVScalar(minVector, -1)

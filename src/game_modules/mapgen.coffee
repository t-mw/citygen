# author: tmwhere.com

PIXI = require('pixi.js/bin/pixi.js')
_ = require('lodash')

noise = require('perlin').noise
Quadtree = require('quadtree').Quadtree
seedrandom = require('seedrandom')

math = require('generic_modules/math')
util = require('generic_modules/utility')
collision = require('generic_modules/collision')

config = require('game_modules/config')

class Segment extends collision.CollisionObject
  @End:
    START: "start"
    END: "end"

  constructor: (start, end, t, q) ->
    obj = @

    start = _.cloneDeep(start)
    end = _.cloneDeep(end)
    t = util.defaultFor(t, 0)
    q = util.defaultFor(q, {}, true)

    @width = if q.highway then config.mapGeneration.HIGHWAY_SEGMENT_WIDTH else config.mapGeneration.DEFAULT_SEGMENT_WIDTH
    @collider = new collision.CollisionObject(this, collision.CollisionObject.Type.LINE, {start: start, end: end, width: @width})

    @roadRevision = 0
    @dirRevision = undefined
    @lengthRevision = undefined

    @cachedDir = undefined
    @cachedLength = undefined

    # representation of road
    @r =
      start: start
      end: end
      setStart: (val) ->
        @start = val
        obj.collider.updateCollisionProperties({start: @start})
        obj.roadRevision++
      setEnd: (val) ->
        @end = val
        obj.collider.updateCollisionProperties({end: @end})
        obj.roadRevision++

    # time-step delay before this road is evaluated
    @t = t
    # meta-information relevant to global goals
    @q = q
    # links backwards and forwards
    @links =
      b: []
      f: []

    @users = []
    [@maxSpeed, @capacity] =
      if (q.highway)
        [1200, 12]
      else
        [800, 6]

  currentSpeed: ->
    # subtract 1 from users length so that a single user can go full speed
    Math.min(config.gameLogic.MIN_SPEED_PROPORTION, 1 - Math.max(0, @users.length - 1) / @capacity) * @maxSpeed

  # clockwise direction
  dir: ->
    if (@dirRevision != @roadRevision)
      @dirRevision = @roadRevision
      vector = math.subtractPoints(@r.end, @r.start)
      @cachedDir = -1 * math.sign(math.crossProduct({x:0, y: 1}, vector)) * math.angleBetween({x: 0, y: 1}, vector)
    return @cachedDir

  length: ->
    if (@lengthRevision != @roadRevision)
      @lengthRevision = @roadRevision
      @cachedLength = math.length(@r.start, @r.end)
    return @cachedLength

  debugLinks: ->
    @q.color = 0x00FF00
    _.each(@links.b, (backwards) ->
      backwards.q.color = 0xFF0000
    )
    _.each(@links.f, (forwards) ->
      forwards.q.color = 0x0000FF
    )

  startIsBackwards: ->
    if (@links.b.length > 0)
      math.equalV(@links.b[0].r.start, @r.start) ||
      math.equalV(@links.b[0].r.end, @r.start)
    else
      math.equalV(@links.f[0].r.start, @r.end) ||
      math.equalV(@links.f[0].r.end, @r.end)

  cost: ->
    @length() / @currentSpeed()

  costTo: (other, fromFraction) ->
    segmentEnd = @endContaining(other)
    return @cost() *
      if fromFraction?
        switch segmentEnd
          when Segment.End.START then fromFraction
          when Segment.End.END then (1-fromFraction)
      else
        0.5

  neighbours: ->
    @links.f.concat(@links.b)

  endContaining: (segment) ->
    startBackwards = @startIsBackwards()
    if @links.b.indexOf(segment) != -1
      return if startBackwards then Segment.End.START else Segment.End.END
    else if @links.f.indexOf(segment) != -1
      return if startBackwards then Segment.End.END else Segment.End.START
    else
      undefined

  linksForEndContaining: (segment) ->
    if @links.b.indexOf(segment) != -1
      @links.b
    else if @links.f.indexOf(segment) != -1
      @links.f
    else
      undefined

  split: (point, segment, segmentList, qTree) ->
    startIsBackwards = @startIsBackwards()

    splitPart = segmentFactory.fromExisting(this)
    addSegment(splitPart, segmentList, qTree)
    splitPart.r.setEnd(point)
    @r.setStart(point)

    # links are not copied using the preceding factory method
    # copy link array for the split part, keeping references the same
    splitPart.links.b = @links.b.slice(0)
    splitPart.links.f = @links.f.slice(0)

    # work out which links correspond to which end of the split segment
    if (startIsBackwards)
      firstSplit = splitPart
      secondSplit = this
      fixLinks = splitPart.links.b
    else
      firstSplit = this
      secondSplit = splitPart
      fixLinks = splitPart.links.f

    _.each(fixLinks, (link) ->
      index = link.links.b.indexOf(this)
      if (index != -1)
        link.links.b[index] = splitPart
      else
        index = link.links.f.indexOf(this)
        link.links.f[index] = splitPart
    , this)
    firstSplit.links.f = []
    firstSplit.links.f.push(segment)
    firstSplit.links.f.push(secondSplit)

    secondSplit.links.b = []
    secondSplit.links.b.push(segment)
    secondSplit.links.b.push(firstSplit)

    segment.links.f.push(firstSplit)
    segment.links.f.push(secondSplit)

segmentFactory = do ->
  return {
    fromExisting: (segment, t, r, q) ->
      t = util.defaultFor(t, segment.t)
      r = util.defaultFor(r, segment.r)
      q = util.defaultFor(q, segment.q)

      return new Segment(r.start, r.end, t, q)
    ,
    usingDirection: (start, dir, length, t, q) ->
      # default to east
      dir = util.defaultFor(dir, 90)
      length = util.defaultFor(length, config.mapGeneration.DEFAULT_SEGMENT_LENGTH)

      end =
        x: start.x + length*math.sinDegrees(dir),
        y: start.y + length*math.cosDegrees(dir)
      return new Segment(start, end, t, q)
  }

heatmap = do ->
  {
    popOnRoad: (r) ->
      (@populationAt(r.start.x, r.start.y) + @populationAt(r.end.x, r.end.y))/2
    populationAt: (x, y) ->
      value1 = (noise.simplex2(x/10000, y/10000) + 1) / 2
      value2 = (noise.simplex2(x/20000 + 500, y/20000 + 500) + 1) / 2
      value3 = (noise.simplex2(x/20000 + 1000, y/20000 + 1000) + 1) / 2
      Math.pow((value1 * value2 + value3) / 2, 2)
  }

doRoadSegmentsIntersect = (r1, r2) ->
  math.doLineSegmentsIntersect(r1.start, r1.end, r2.start, r2.end, true)

localConstraints = (segment, segments, qTree, debugData) ->
  action =
    priority: 0,
    func: undefined,
    q: {}

  matches = qTree.retrieve(segment.collider.limits())
  for i in [0..matches.length-1] by 1
    other = matches[i].o

    # intersection check
    if (action.priority <= 4)
      intersection = doRoadSegmentsIntersect(segment.r, other.r)
      if (intersection)
        if (!action.q.t? || intersection.t < action.q.t)
          action.q.t = intersection.t

          do (other, intersection) ->
            action.priority = 4
            action.func = ->
              # if intersecting lines are too similar don't continue
              if util.minDegreeDifference(other.dir(), segment.dir()) < config.mapGeneration.MINIMUM_INTERSECTION_DEVIATION
                return false

              other.split(intersection, segment, segments, qTree)
              segment.r.end = intersection
              segment.q.severed = true

              if (debugData?)
                if (!debugData.intersections?)
                  debugData.intersections = []
                debugData.intersections.push(
                  x: intersection.x
                  y: intersection.y
                )

              return true

    # snap to crossing within radius check
    if (action.priority <= 3)
      # current segment's start must have been checked to have been created.
      # other segment's start must have a corresponding end.
      if (math.length(segment.r.end, other.r.end) <= config.mapGeneration.ROAD_SNAP_DISTANCE)

        do (other) ->
          point = other.r.end
          action.priority = 3
          action.func = ->
            segment.r.end = point
            segment.q.severed = true

            # update links of otherSegment corresponding to other.r.end
            links = if other.startIsBackwards() then other.links.f else other.links.b
            # check for duplicate lines, don't add if it exists
            # this should be done before links are setup, to avoid having to undo that step
            if _.any(links, (link) ->
              ((math.equalV(link.r.start, segment.r.end) && math.equalV(link.r.end, segment.r.start)) ||
              (math.equalV(link.r.start, segment.r.start) && math.equalV(link.r.end, segment.r.end))))
              return false

            _.each(links, (link) ->
              # pick links of remaining segments at junction corresponding to other.r.end
              link.linksForEndContaining(other).push(segment)

              # add junction segments to snapped segment
              segment.links.f.push(link)
            )

            links.push(segment)
            segment.links.f.push(other)

            if (debugData?)
              if (!debugData.snaps?)
                debugData.snaps = []
              debugData.snaps.push(
                x: point.x
                y: point.y
              )

            return true

    # intersection within radius check
    if (action.priority <= 2)

      {distance2, pointOnLine, lineProj2, length2} = math.distanceToLine(segment.r.end, other.r.start, other.r.end)
      if (distance2 < config.mapGeneration.ROAD_SNAP_DISTANCE * config.mapGeneration.ROAD_SNAP_DISTANCE &&
      lineProj2 >= 0 && lineProj2 <= length2)

        do (other) ->
          point = pointOnLine
          action.priority = 2
          action.func = ->
            segment.r.end = point
            segment.q.severed = true

            # if intersecting lines are too similar don't continue
            if util.minDegreeDifference(other.dir(), segment.dir()) < config.mapGeneration.MINIMUM_INTERSECTION_DEVIATION
              return false

            other.split(point, segment, segments, qTree)

            if (debugData?)
              if (!debugData.intersectionsRadius?)
                debugData.intersectionsRadius = []
              debugData.intersectionsRadius.push(
                x: point.x
                y: point.y
              )

            return true

  if (action.func)
    return action.func()

  return true

globalGoals = do ->
  return {
    generate: (previousSegment) ->
      newBranches = []
      if (!previousSegment.q.severed)

        template = (direction, length, t, q) ->
            segmentFactory.usingDirection(previousSegment.r.end, direction, length, t, q)

        # used for highways or going straight on a normal branch
        templateContinue = _.partialRight(template, previousSegment.length(), 0, previousSegment.q)
        # not using q, i.e. not highways
        templateBranch = _.partialRight(
          template, config.mapGeneration.DEFAULT_SEGMENT_LENGTH, if previousSegment.q.highway then config.mapGeneration.NORMAL_BRANCH_TIME_DELAY_FROM_HIGHWAY else 0)

        continueStraight = templateContinue(previousSegment.dir())
        straightPop = heatmap.popOnRoad(continueStraight.r)

        if (previousSegment.q.highway)
          randomStraight = templateContinue(previousSegment.dir() + config.mapGeneration.RANDOM_STRAIGHT_ANGLE())

          randomPop = heatmap.popOnRoad(randomStraight.r)
          roadPop
          if (randomPop > straightPop)
            newBranches.push(randomStraight)
            roadPop = randomPop
          else
            newBranches.push(continueStraight)
            roadPop = straightPop
          if (roadPop > config.mapGeneration.HIGHWAY_BRANCH_POPULATION_THRESHOLD)

            if (Math.random() < config.mapGeneration.HIGHWAY_BRANCH_PROBABILITY)
              leftHighwayBranch = templateContinue(previousSegment.dir() - 90 + config.mapGeneration.RANDOM_BRANCH_ANGLE())
              newBranches.push(leftHighwayBranch)
            else if (Math.random() < config.mapGeneration.HIGHWAY_BRANCH_PROBABILITY)
              rightHighwayBranch = templateContinue(previousSegment.dir() + 90 + config.mapGeneration.RANDOM_BRANCH_ANGLE())
              newBranches.push(rightHighwayBranch)

        else if (straightPop > config.mapGeneration.NORMAL_BRANCH_POPULATION_THRESHOLD)
          newBranches.push(continueStraight)

        if (straightPop > config.mapGeneration.NORMAL_BRANCH_POPULATION_THRESHOLD)
          if (Math.random() < config.mapGeneration.DEFAULT_BRANCH_PROBABILITY)
            leftBranch = templateBranch(previousSegment.dir() - 90 + config.mapGeneration.RANDOM_BRANCH_ANGLE())
            newBranches.push(leftBranch)
          else if (Math.random() < config.mapGeneration.DEFAULT_BRANCH_PROBABILITY)
            rightBranch = templateBranch(previousSegment.dir() + 90 + config.mapGeneration.RANDOM_BRANCH_ANGLE())
            newBranches.push(rightBranch)

      for i in [0..newBranches.length-1] by 1
        do (branch = newBranches[i]) ->
          branch.setupBranchLinks = ->
            # setup links between each current branch and each existing branch stemming from the previous segment
            _.each(previousSegment.links.f, (link) ->
              @links.b.push(link)
              link.linksForEndContaining(previousSegment).push(this)
            , @)

            previousSegment.links.f.push(@)
            @links.b.push(previousSegment)

      return newBranches
  }

addSegment = (segment, segmentList, qTree) ->
  segmentList.push(segment)
  qTree.insert(segment.collider.limits())

generate = (seed) ->
  debugData = {}

  Math.seedrandom(seed)
  # this perlin noise library only supports 65536 different seeds
  noise.seed(Math.random())

  priorityQ = []
  # setup first segments in queue
  do ->
    rootSegment = new Segment({x: 0, y: 0}, {x: config.mapGeneration.HIGHWAY_SEGMENT_LENGTH, y: 0}, 0, {highway: true})
    oppositeDirection = segmentFactory.fromExisting(rootSegment)
    newEnd =
      x: rootSegment.r.start.x - config.mapGeneration.HIGHWAY_SEGMENT_LENGTH
      y: oppositeDirection.r.end.y
    oppositeDirection.r.setEnd(newEnd)
    oppositeDirection.links.b.push(rootSegment)
    rootSegment.links.b.push(oppositeDirection)
    priorityQ.push(rootSegment)
    priorityQ.push(oppositeDirection)

  segments = []
  qTree = new Quadtree(config.mapGeneration.QUADTREE_PARAMS,
    config.mapGeneration.QUADTREE_MAX_OBJECTS, config.mapGeneration.QUADTREE_MAX_LEVELS)

  while (priorityQ.length > 0 && segments.length < config.mapGeneration.SEGMENT_COUNT_LIMIT)
    # pop smallest r(ti, ri, qi) from Q (i.e., smallest ‘t’)
    minT = undefined
    minT_i = 0
    _.each(priorityQ, (segment, i) ->
      if (!minT? || segment.t < minT)
        minT = segment.t
        minT_i = i
    )

    minSegment = priorityQ.splice(minT_i, 1)[0]

    accepted = localConstraints(minSegment, segments, qTree, debugData)
    if (accepted)
      if (minSegment.setupBranchLinks?)
        minSegment.setupBranchLinks()
      addSegment(minSegment, segments, qTree)
      _.each(globalGoals.generate(minSegment), (newSegment) ->
        newSegment.t = minSegment.t + 1 + newSegment.t
        priorityQ.push(newSegment)
      )

  id = 0
  for segment in segments
    segment.id = id++

  console.log("#{segments.length} segments generated.")

  return {
    segments: segments
    qTree: qTree
    heatmap: heatmap
    debugData: debugData
  }

module.exports = {
  Segment: Segment
  generate: generate
}

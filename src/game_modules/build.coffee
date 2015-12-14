# author: tmwhere.com

_ = require('lodash')

astar = require('generic_modules/astar')
collision = require('generic_modules/collision')
math = require('generic_modules/math')
util = require('generic_modules/utility')

config = require('game_modules/config')
mapgen = require('game_modules/mapgen')

class Building
  @Type:
    RESIDENTIAL: "residential"
    IMPORT: "import"

  @id: 0

  constructor: (@center, @dir, @diagonal, @type, aspectRatio) ->
    obj = @

    aspectRatio = util.defaultFor(aspectRatio, 1)
    # degrees to deviate either end to produce desired aspect ratio
    @aspectDegree = math.atanDegrees(aspectRatio)
    @corners = @generateCorners()

    @collider = new collision.CollisionObject(this, collision.CollisionObject.Type.RECT, {corners: @corners})

    @supply = []
    @demand = []

    @id = Building.id
    Building.id += 1

  generateCorners: ->
    [
      { x: @center.x + @diagonal * math.sinDegrees(+@aspectDegree + @dir), y: @center.y + @diagonal * math.cosDegrees(+@aspectDegree + @dir) }
      { x: @center.x + @diagonal * math.sinDegrees(-@aspectDegree + @dir),  y: @center.y + @diagonal * math.cosDegrees(-@aspectDegree + @dir) }
      { x: @center.x + @diagonal * math.sinDegrees(180 + @aspectDegree + @dir), y: @center.y + @diagonal * math.cosDegrees(180 + @aspectDegree + @dir) }
      { x: @center.x + @diagonal * math.sinDegrees(180 - @aspectDegree + @dir), y: @center.y + @diagonal * math.cosDegrees(180 - @aspectDegree + @dir) }
    ]

  setCenter: (val) ->
    @center = val
    @corners = @generateCorners()
    @collider.updateCollisionProperties({corners: @corners})

  setDir: (val) ->
    @dir = val
    @corners = @generateCorners()
    @collider.updateCollisionProperties({corners: @corners})

buildingsInRangeOf = (location, qTree) ->
  {x, y} = location
  matches = qTree.retrieve({
    x: x - config.gameLogic.DEFAULT_PICKUP_RANGE
    y: y - config.gameLogic.DEFAULT_PICKUP_RANGE
    width: config.gameLogic.DEFAULT_PICKUP_RANGE * 2
    height: config.gameLogic.DEFAULT_PICKUP_RANGE * 2
  })

  buildings = []
  range = new collision.CollisionObject(undefined, collision.CollisionObject.Type.CIRCLE,
    {center: {x: x, y: y}, radius: config.gameLogic.DEFAULT_PICKUP_RANGE})

  _.each(matches, (match) ->
    # if it's a building
    if (match.o.supply? && match.o.demand? && range.collide(match.o.collider))
      buildings.push(match.o)
  )

  return buildings

module.exports =
  buildingFactory: do ->
    {
      fromProbability: (time) ->
        if Math.random() < 0.4
          return @byType(Building.Type.IMPORT, time)
        else
          return @byType(Building.Type.RESIDENTIAL, time)

      byType: (type, time) ->
        building = undefined
        switch type
          when Building.Type.RESIDENTIAL
            building = new Building({x: 0, y: 0}, 0, 80, Building.Type.RESIDENTIAL, math.randomRange(0.5, 2))
          when Building.Type.IMPORT
            building = new Building({x: 0, y: 0}, 0, 150, Building.Type.IMPORT, math.randomRange(0.5, 2))
        return building

      aroundSegment: (buildingTemplate, segment, count, radius, quadtree) ->
        buildings = []
        for i in [0...count] by 1
          randomAngle = Math.random() * 360
          randomRadius = Math.random() * radius
          buildingCenter =
            x: 0.5 * (segment.r.start.x + segment.r.end.x) + randomRadius * math.sinDegrees(randomAngle)
            y: 0.5 * (segment.r.start.y + segment.r.end.y) + randomRadius * math.cosDegrees(randomAngle)
          building = buildingTemplate()
          building.setCenter(buildingCenter)
          building.setDir(segment.dir())

          permitBuilding = false
          for i in [0...config.mapGeneration.BUILDING_PLACEMENT_LOOP_LIMIT] by 1
            collisionCount = 0
            # must query quadtree here, since building limits may have changed due to collision in previous iteration
            potentialCollisions = quadtree.retrieve(building.collider.limits())
            potentialCollisions = potentialCollisions.concat(buildings)
            for obj in potentialCollisions
              # if it is a quadtree result, unpack it
              if (obj.o?)
                obj = obj.o

              result = building.collider.collide(obj.collider)
              if (result)
                collisionCount += 1
                # no point continuing if on final loop
                if (i == config.mapGeneration.BUILDING_PLACEMENT_LOOP_LIMIT - 1)
                  break

                # shift building to avoid colliding with existing object
                building.setCenter(math.addPoints(building.center, result))

            # no further checks necessary
            if (collisionCount == 0)
              permitBuilding = true
              break

          if (permitBuilding)
            buildings.push(building)

        return buildings
    }

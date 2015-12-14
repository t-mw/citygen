# author: tmwhere.com

_ = require('lodash')

astar = require('generic_modules/astar')
collision = require('generic_modules/collision')
math = require('generic_modules/math')
util = require('generic_modules/utility')

config = require('game_modules/config')
mapgen = require('game_modules/mapgen')

class Cargo
  constructor: (@resourceType, @routePartialIdx, @capacity, @level) ->

class Resource
  @Type:
    JAM: "jam"
    PEOPLE: "people"
    FOOD: "food"

  @Class:
    SUPPLY: "supply"
    DEMAND: "demand"

  constructor: (@type, @class, time, options) ->
    @previousUpdateTime = time
    @boostRemaining = 0

    # per minute
    @baseRegeneration = options.regeneration
    @regeneration = @baseRegeneration
    @level = options.initialLevel
    switch @class
      when Resource.Class.SUPPLY
        @forBoost = util.defaultFor(options.boost, undefined)
        @boostFactor = util.defaultFor(options.boostFactor, config.gameLogic.DEFAULT_BOOST_FACTOR)
        @boostDuration = util.defaultFor(options.boostDuration, config.gameLogic. DEFAULT_BOOST_DURATION)

  update: (time) ->
    diffMs = time - @previousUpdateTime
    @previousUpdateTime = time
    minutes = (diffMs / 60000)

    boostMinutes = 0
    normalMinutes = minutes
    if (@boostRemaining > 0)
      boostMinutes = Math.min(minutes, @boostRemaining)
      @boostRemaining -= boostMinutes
      normalMinutes = minutes - boostMinutes

    @level += boostMinutes * @regeneration
    if (@boostRemaining <= 0)
      @regeneration = @baseRegeneration

    @level += normalMinutes * @baseRegeneration

  receivedCargo: (cargo) ->
    transferAmount = @_receivedType(cargo.resourceType, cargo.level)
    cargo.level -= transferAmount
    return transferAmount

  receivedResource: (resource) ->
    resource.level -= @_receivedType(resource.type, resource.level)

  fillCargo: (cargo) ->
    if (@class == Resource.Class.SUPPLY && cargo.resourceType == @type)
      remainingCapacity = cargo.capacity - cargo.level
      resourceAmountTransfer = Math.min(remainingCapacity, @level)
      cargo.level += resourceAmountTransfer
      @level -= resourceAmountTransfer

  _receivedType: (type, level) ->
    if (@forBoost? && resource.type == @forBoost)
      @boostRemaining = @boostDuration
      @regeneration = @baseRegeneration * @boostFactor

    toTransfer = 0
    if (@class == Resource.Class.DEMAND && @type == type)
      toTransfer = Math.min(@level, level)
      @level -= toTransfer

    return toTransfer

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

class TransportRoute
  @WhatShouldBeDropped: (enteringCargo, exitingCargo, demand) ->
    drops = []
    enteringCopy = enteringCargo.slice(0)
    enteringToKeep = []
    exitingCopy = exitingCargo.slice(0)
    for cargo in enteringCopy
      cargoIdx = _.findIndex(exitingCopy, (current) -> current.resourceType == cargo.resourceType)
      demandHere = _.any(demand, (demandResource) -> demandResource.type == cargo.resourceType)
      # drop the cargo if it is not in the cargo exiting the location or there is demand at location
      if cargoIdx == -1 || demandHere
        drops.push(cargo)
      else
        enteringToKeep.push(cargo)
        exitingCopy.splice(cargoIdx, 1)

    return {
      drops: drops
      finalCargo: enteringToKeep.concat(exitingCopy)
    }

  constructor: (@id, @vehicle_id, @_qTree) ->
    @active = false
    @drawPosition = undefined
    @_route = []
    @_buildings = []
    @_pickups = []
    @_supply = []
    @_demand = []
    @_currentLocation = {segment: undefined, fraction: undefined, atTime: undefined, pathIdx: undefined}
    @_path = []
    @_pathStart = undefined
    @_pathEnd = undefined
    @_routePartialIdx = 0

  currentPosition: ->
    return math.fractionBetween(@_currentLocation.segment.r.start, @_currentLocation.segment.r.end, @_currentLocation.fraction)

  addLocation: (astarLocation, buildings, i) ->
    location = math.fractionBetween(astarLocation.o.r.start, astarLocation.o.r.end, astarLocation.fraction)
    newRoutePartial = {location: location, astarLocation: astarLocation}
    newBuildings = if buildings? then buildings else buildingsInRangeOf(location, @_qTree)

    if (i? && i < @path.length)
      @_route[i] = newRoutePartial
      @_buildings[i] = newBuildings
      @_pickups[i] = []
      changedI = i
    else
      @_route.push(newRoutePartial)
      @_buildings.push(newBuildings)
      @_pickups.push([])
      @_supply.push([])
      @_demand.push([])
      changedI = @_route.length - 1

    supplyResources = []
    demandResources = []
    for building in @_buildings[changedI]
      supplyResources = supplyResources.concat(building.supply)
      demandResources = demandResources.concat(building.demand)
    @_supply[changedI] = supplyResources
    @_demand[changedI] = demandResources

  setActive: (value, time) ->
    timeSecs = time / 1000;
    @active = value

    if (value == true)
      # avoid 'jumping' of location after reactivating
      @_currentLocation.atTime = timeSecs

  update: (time) ->
    timeSecs = time / 1000

    # if starting from completely inactive without a location
    if (!@_currentLocation.segment? && @_route.length > 0)
      astarLocation = @_route[@_routePartialIdx].astarLocation
      @_currentLocation.segment = astarLocation.o
      @_currentLocation.fraction = astarLocation.fraction
      @_currentLocation.atTime = timeSecs
      @_currentLocation.pathIdx = 0

      @_reachLocation(@_routePartialIdx)

    timeRemainder = timeSecs - @_currentLocation.atTime
    if (@active && @_route.length > 0)
      while (timeRemainder > 0)
        currentIdx = @_currentLocation.pathIdx
        segment = @_currentLocation.segment

        if currentIdx == @_path.length - 1
          # in end segment
          segmentEnd = segment.endContaining(@_path[currentIdx - 1])
          remainingFraction = switch (segmentEnd)
            when mapgen.Segment.End.START then @_pathEnd.fraction - @_currentLocation.fraction
            when mapgen.Segment.End.END then (1 - @_pathEnd.fraction) - (1 - @_currentLocation.fraction)

          # add to or subtract from fraction to move 'along' path
          fractionAdvanceSign = switch (segmentEnd)
            when mapgen.Segment.End.START then 1
            when mapgen.Segment.End.END then -1
        else
          segmentEnd = segment.endContaining(@_path[currentIdx + 1])
          remainingFraction = switch (segmentEnd)
            when mapgen.Segment.End.START then @_currentLocation.fraction
            when mapgen.Segment.End.END then 1 - @_currentLocation.fraction

          # add to or subtract from fraction to move 'along' path
          fractionAdvanceSign = switch (segmentEnd)
            when mapgen.Segment.End.START then -1
            when mapgen.Segment.End.END then 1

        speed = @_currentLocation.segment.currentSpeed()
        segmentLength = @_currentLocation.segment.length()

        remainingLength = remainingFraction * segmentLength
        availableTimeOnCurrentSegment = remainingLength / speed
        timeToAdvance = Math.min(availableTimeOnCurrentSegment, timeRemainder)

        fractionToAdvance = (timeToAdvance * speed / segmentLength)
        @_currentLocation.fraction = @_currentLocation.fraction + fractionToAdvance * fractionAdvanceSign
        remainingLengthNow = (remainingFraction - fractionToAdvance) * segmentLength

        if (remainingLengthNow < config.gameLogic.MIN_LENGTH_FOR_VEHICLE_ARRIVAL)
          @_advancePath(@_currentLocation.pathIdx, timeSecs)

        @_currentLocation.atTime = timeSecs

        timeRemainder -= timeToAdvance

  setPickups: (i, pickups) ->
    if (i < @_pickups.length)
      @_pickups[i] = pickups

  addPickup: (i, type) ->
    @_pickups[i].push(new Cargo(type, i, config.gameLogic.DEFAULT_CARGO_CAPACITY, 0))

  removePickup: (routePartialIdx, pickupIdx) ->
    @_pickups[routePartialIdx].splice(pickupIdx, 1)

  getExpectedDrops: (i) ->
    drops = []
    if (i < @_pickups.length)
      precedingI = (i-1+@_route.length) % @_route.length
      precedingCargo = @_pickups[precedingI]
      currentCargo = @_pickups[i]
      drops = TransportRoute.WhatShouldBeDropped(precedingCargo, currentCargo, @_demand[i]).drops
    return drops

  getPickups: (i) ->
    return @_pickups[i]

  getSupply: (i, time) ->
    supply = @_supply[i]
    for resource in supply
      resource.update(time)
    return supply

  getDemand: (i, time) ->
    demand = @_demand[i]
    for resource in demand
      resource.update(time)
    return demand

  getGroupedSupply: (i, time) ->
    return @_processResources(@_supply[i], time)

  getGroupedDemand: (i, time) ->
    return @_processResources(@_demand[i], time)

  getAvailableCargo: (i) ->
    allTypes = _.values(Resource.Type)
    cargoFirst = []
    cargoRemaining = []
    for cargo in allTypes
      if (_.any(@_supply[i], (supplyResource) -> supplyResource.type == cargo))
        cargoFirst.push({type: cargo, supplied: true})
      else
        cargoRemaining.push({type: cargo, supplied: false})
    return cargoFirst.concat(cargoRemaining)

  cost: ->
    _.reduce(@path[1..-2], (costSoFar, segment) ->
      costSoFar + segment.cost()
    , 0) + @pathStart.o.costTo(@path[1], @pathStart.fraction) + @pathEnd.o.costTo(@path[@path.length-2], @pathEnd.fraction)

  length: ->
    return @_route.length

  _advancePath: (pathIdx, timeSecs) ->
    endSection = (pathIdx == @_path.length - 1)
    if (endSection && @_route.length > 1)
      @_reachLocation(@_routePartialIdx)
      newPathIdx = 0
      # fraction remains the same since new path start will be at the current location
    else
      newPathIdx = pathIdx + 1
      previousSegment = @_path[pathIdx]
      @_currentLocation.fraction = switch (@_path[newPathIdx].endContaining(previousSegment))
        when mapgen.Segment.End.START then 0
        when mapgen.Segment.End.END then 1

    @_currentLocation.segment = @_path[newPathIdx]
    @_currentLocation.atTime = timeSecs
    @_currentLocation.pathIdx = newPathIdx

  _reachLocation: (routePartialIdx) ->
    @_routePartialIdx = (routePartialIdx + 1) % @_route.length
    routePartial = @_route[@_routePartialIdx]
    @_setDestination(routePartial.astarLocation.o, routePartial.astarLocation.fraction)

    if (@onLocationReached?)
      @onLocationReached(@id, routePartialIdx, @vehicle_id)

  _setDestination: (endSegment, endFraction) ->
    @_pathStart = new astar.PathLocation(@_currentLocation.segment, @_currentLocation.fraction)
    @_pathEnd = new astar.PathLocation(endSegment, endFraction)
    @_path = astar.calc.find(@_pathStart, @_pathEnd)

  # group supply/demand by resource
  _processResources: (resourceCollection, time) ->
    processed = {}
    for resource in resourceCollection
      resource.update(time)
      if (!processed[resource.type])
        processed[resource.type] = 0
      processed[resource.type] += resource.level
    return processed


module.exports =
  Cargo: Cargo
  Resource: Resource
  Building: Building
  TransportRoute: TransportRoute
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
            building.supply.push(new Resource(Resource.Type.PEOPLE, Resource.Class.SUPPLY, time,
              {regeneration: 1, initialLevel: 3, boost: Resource.Type.FOOD}))
            building.demand.push(new Resource(Resource.Type.FOOD, Resource.Class.DEMAND, time,
              {regeneration: 0.5, initialLevel: 3}))
          when Building.Type.IMPORT
            building = new Building({x: 0, y: 0}, 0, 150, Building.Type.IMPORT, math.randomRange(0.5, 2))
            building.supply.push(new Resource(Resource.Type.FOOD, Resource.Class.SUPPLY, time,
              {regeneration: 1, initialLevel: 3, boost: Resource.Type.PEOPLE}))
            building.demand.push(new Resource(Resource.Type.PEOPLE, Resource.Class.DEMAND, time,
              {regeneration: 0.5, initialLevel: 3}))
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
  buildingsInRangeOf: buildingsInRangeOf

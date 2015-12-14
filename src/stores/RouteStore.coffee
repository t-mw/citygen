merge = require('react/lib/merge')

build = require('game_modules/build')

AppDispatcher = require('../dispatcher/AppDispatcher')
EventEmitter = require('events').EventEmitter
Constants = require('../dispatcher/Constants')
MapStore = require('./MapStore')
VehicleActions = require('../actions/VehicleActions')
VehicleStore = require('./VehicleStore')

CHANGE_EVENT = 'change'

_currentId = 0
_routes = {}

# one-to-many relationship.
_routesByVehicle = {}

addLocation = (vehicle_id, aStarLocation, onLocationReached) ->
  # TODO: Assign the route segment id from the server

  if (!_routesByVehicle[vehicle_id]?)
    id = _currentId++
    route = new build.TransportRoute(id, vehicle_id, MapStore.getQTree())
    route.onLocationReached = _.bind(onLocationReached)
    _routes[id] = route
    _routesByVehicle[vehicle_id] = route
  else
    route = _routesByVehicle[vehicle_id]

  route.addLocation(aStarLocation)

addPickup = (route_id, routePartialIdx, resourceType, amount) ->
  route = _routes[route_id]
  for i in [0...amount] by 1
    route.addPickup(routePartialIdx, resourceType)

removePickup = (route_id, routePartialIdx, pickupIdx) ->
  route = _routes[route_id]
  route.removePickup(routePartialIdx, pickupIdx)

setActive = (vehicle_id, active, time) ->
  route = _routesByVehicle[vehicle_id]
  # if route has no locations it will be undefined
  if (route?)
    route.setActive(active, time)

RouteStore = merge(EventEmitter.prototype, {
  get: (id) ->
    return _routes[id]

  getAll: ->
    return _routes

  getByVehicleId: (vehicle_id) ->
    return _routesByVehicle[vehicle_id] || {length: -> return 0} # mock route object

  emitChange: ->
    @emit(CHANGE_EVENT)

  addChangeListener: (callback) ->
    @on(CHANGE_EVENT, callback)

  removeChangeListener: (callback) ->
    @removeListener(CHANGE_EVENT, callback)

  dispatcherIndex: AppDispatcher.register((payload) ->
    action = payload.action

    switch (action.actionType)
      when Constants.ActionTypes.ROUTE_PARTIAL_CREATE
        vehicle_id = action.vehicle_id
        aStarLocation = action.aStarLocation
        if (vehicle_id? && aStarLocation)
          addLocation(vehicle_id, aStarLocation, RouteStore._onLocationReached)
          RouteStore.emitChange()

      when Constants.ActionTypes.ROUTE_ADD_PICKUP
        route_id = action.route_id
        routePartialIdx = action.routePartialIdx
        resourceType = action.resourceType
        amount = action.amount
        addPickup(route_id, routePartialIdx, resourceType, amount)
        RouteStore.emitChange()

      when Constants.ActionTypes.ROUTE_REMOVE_PICKUP
        route_id = action.route_id
        routePartialIdx = action.routePartialIdx
        pickupIdx = action.pickupIdx
        removePickup(route_id, routePartialIdx, pickupIdx)
        RouteStore.emitChange()

      when Constants.ActionTypes.ROUTE_SET_ACTIVE
        vehicle_id = action.vehicle_id
        active = action.active
        time = new Date().getTime()
        setActive(vehicle_id, active, time)

      # add more cases for other actionTypes ...

    return true # No errors. Needed by promise in Dispatcher.
  )

  _onLocationReached: (route_id, routePartialIdx, vehicle_id) ->
    vehicle = VehicleStore.get(vehicle_id)

    time = new Date().getTime()
    route = RouteStore.get(route_id)
    pickups = route.getPickups(routePartialIdx)
    supply = route.getSupply(routePartialIdx, time)
    demand = route.getDemand(routePartialIdx, time)

    {drops, finalCargo} = build.TransportRoute.WhatShouldBeDropped(vehicle.cargo, pickups, demand)
    for cargo in finalCargo
      for supplyResource in supply
        supplyResource.fillCargo(cargo)
    for dropCargo in drops
      for demandResource in demand
        demandResource.receivedCargo(dropCargo)

    RouteStore.emitChange()
    VehicleActions.setCargo(vehicle_id, finalCargo)

})

module.exports = RouteStore

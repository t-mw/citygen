AppDispatcher = require('../dispatcher/AppDispatcher')
Constants = require('../dispatcher/Constants')

RouteActions =
  addLocation: (vehicle_id, aStarLocation) ->
    AppDispatcher.handleLogicAction(
      actionType: Constants.ActionTypes.ROUTE_PARTIAL_CREATE
      vehicle_id: vehicle_id
      aStarLocation: aStarLocation
    )

  addPickup: (route_id, routePartialIdx, resourceType, amount) ->
    AppDispatcher.handleLogicAction(
      actionType: Constants.ActionTypes.ROUTE_ADD_PICKUP
      route_id: route_id
      routePartialIdx: routePartialIdx
      resourceType: resourceType
      amount: amount
    )

  removePickup: (route_id, routePartialIdx, pickupIdx) ->
    AppDispatcher.handleLogicAction(
      actionType: Constants.ActionTypes.ROUTE_REMOVE_PICKUP
      route_id: route_id
      routePartialIdx: routePartialIdx
      pickupIdx: pickupIdx
    )

  setActive: (vehicle_id, active) ->
    AppDispatcher.handleLogicAction(
      actionType: Constants.ActionTypes.ROUTE_SET_ACTIVE
      vehicle_id: vehicle_id
      active: active
    )


module.exports = RouteActions

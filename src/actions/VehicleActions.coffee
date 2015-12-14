AppDispatcher = require('../dispatcher/AppDispatcher')
Constants = require('../dispatcher/Constants')

VehicleActions =
  create: (type_id, player_id) ->
    AppDispatcher.handleViewAction(
      actionType: Constants.ActionTypes.VEHICLE_CREATE
      type_id: type_id
      player_id: player_id
    )

  setCargo: (vehicle_id, cargo) ->
    AppDispatcher.handleLogicAction(
      actionType: Constants.ActionTypes.VEHICLE_SET_CARGO
      vehicle_id: vehicle_id
      cargo: cargo
    )

module.exports = VehicleActions

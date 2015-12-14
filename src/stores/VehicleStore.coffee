merge = require('react/lib/merge')

AppDispatcher = require('../dispatcher/AppDispatcher')
EventEmitter = require('events').EventEmitter
Constants = require('../dispatcher/Constants')

PlayerStore = require('./PlayerStore')

CHANGE_EVENT = 'change'

_currentId = 0
_vehicles = {}
_vehiclesByPlayer = {}

create = (type_id, player_id) ->
  # TODO: Assign the vehicle id from the server
  id = _currentId++

  newVehicle =
    id: id,
    type_id: type_id
    cargo: []

  _vehicles[id] = newVehicle

  if (!_vehiclesByPlayer[player_id]?)
    _vehiclesByPlayer[player_id] = []
  _vehiclesByPlayer[player_id].push(newVehicle)

setCargo = (vehicle_id, cargo) ->
  vehicle = _vehicles[vehicle_id]
  vehicle.cargo = cargo

destroy = (id) ->
  delete _vehicles[id]

VehicleStore = merge(EventEmitter.prototype, {
  get: (id) ->
    return _vehicles[id]

  getByPlayerId: (player_id) ->
    return _vehiclesByPlayer[player_id]

  getAll: ->
    return _vehicles

  emitChange: ->
    @emit(CHANGE_EVENT)

  addChangeListener: (callback) ->
    @on(CHANGE_EVENT, callback)

  removeChangeListener: (callback) ->
    @removeListener(CHANGE_EVENT, callback)

  dispatcherIndex: AppDispatcher.register((payload) ->
    action = payload.action

    switch (action.actionType)
      when Constants.ActionTypes.VEHICLE_CREATE
        type_id = action.type_id
        player_id = action.player_id
        if (type_id? && player_id?)
          create(type_id, player_id)
          VehicleStore.emitChange()

      when Constants.ActionTypes.VEHICLE_SET_CARGO
        vehicle_id = action.vehicle_id
        cargo = action.cargo
        setCargo(vehicle_id, cargo)
        VehicleStore.emitChange()

      # add more cases for other actionTypes ...

    return true # No errors. Needed by promise in Dispatcher.
  )
})

module.exports = VehicleStore

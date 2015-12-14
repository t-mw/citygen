merge = require('react/lib/merge')

_vehicleTypes = {}

_currentId = 0

VehicleTypeStore =
  get: (id) ->
    return _vehicleTypes[id]

  getAll: ->
    return _vehicleTypes

  create: (properties) ->
    id = _currentId++

    _vehicleTypes[id] = merge({id: id}, properties)

  addChangeListener: (callback) ->
  
  removeChangeListener: (callback) ->

# TODO: Initialise types from the server
VehicleTypeStore.create({type: "Stockbull", capacity: 2, speed: 2, price: 10000})
VehicleTypeStore.create({type: "Silverbeam", capacity: 6, speed: 10, price: 30000})

module.exports = VehicleTypeStore
keyMirror = require('react/lib/keyMirror')

module.exports =
  ActionTypes: keyMirror(
    VEHICLE_CREATE: null
    VEHICLE_SET_CARGO: null
    ROUTE_PARTIAL_CREATE: null
    ROUTE_SET_ACTIVE: null
    ROUTE_ADD_PICKUP: null
    ROUTE_REMOVE_PICKUP: null
    MAP_GENERATE: null
    MAP_FACTOR_TARGET_ZOOM: null
    )
  PayloadSources: keyMirror(
    SERVER_ACTION: null
    VIEW_ACTION: null
    LOGIC_ACTION: null
    )
  OverlayModes: keyMirror(
    EDIT_VEHICLE: null
    NEW_VEHICLE: null
    NEW_ROUTE_PARTIAL_SELECTION: null
    )

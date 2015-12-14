AppDispatcher = require('../dispatcher/AppDispatcher')
Constants = require('../dispatcher/Constants')

MapActions =
  generate: (seed) ->
    AppDispatcher.handleLogicAction(
      actionType: Constants.ActionTypes.MAP_GENERATE
      seed: seed
    )
  factorTargetZoom: (factor) ->
    AppDispatcher.handleLogicAction(
      actionType: Constants.ActionTypes.MAP_FACTOR_TARGET_ZOOM
      factor: factor
    )

module.exports = MapActions

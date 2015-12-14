merge = require('react/lib/merge')

mapgen = require('game_modules/mapgen')

AppDispatcher = require('../dispatcher/AppDispatcher')
EventEmitter = require('events').EventEmitter
Constants = require('../dispatcher/Constants')

CHANGE_EVENT = 'change'

_segments = []
_segmentsById = {}
_qTree = undefined
_heatmap = undefined
_debugData = undefined
_targetZoom = 0.05 * window.devicePixelRatio

MapStore = merge(EventEmitter.prototype, {
  get: (id) ->
    return _segmentsById[id]

  # NB: returns an array, should not be indexed by segment_id
  getSegments: ->
    return _segments

  getQTree: ->
    return _qTree

  getHeatmap: ->
    return _heatmap

  getDebugData: ->
    return _debugData

  getTargetZoom: ->
    return _targetZoom

  emitChange: ->
    @emit(CHANGE_EVENT)

  addChangeListener: (callback) ->
    @on(CHANGE_EVENT, callback)

  removeChangeListener: (callback) ->
    @removeListener(CHANGE_EVENT, callback)

  dispatcherIndex: AppDispatcher.register((payload) ->
    action = payload.action

    switch (action.actionType)
      when Constants.ActionTypes.MAP_GENERATE
        {segments, qTree, heatmap, debugData} = mapgen.generate(action.seed)
        _segments = segments
        _qTree = qTree
        _heatmap = heatmap
        _debugData = debugData

        _segmentsById = {}
        for segment in segments
          _segmentsById[segment.id] = segment

        MapStore.emitChange()
      when Constants.ActionTypes.MAP_FACTOR_TARGET_ZOOM
        _targetZoom = _targetZoom * action.factor

      # add more cases for other actionTypes ...

    return true # No errors. Needed by promise in Dispatcher.
  )
})

module.exports = MapStore

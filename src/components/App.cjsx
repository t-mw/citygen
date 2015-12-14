# @cjsx React.DOM

_ = require('lodash')
React = require('react')

config = require('game_modules/config')

GameCanvas = require('./GameCanvas')
ToggleButton = require('./ToggleButton')
MapActions = require('../actions/MapActions')

App = React.createClass
  getInitialState: ->
    overlayData: undefined
    segmentCountLimit: config.mapGeneration.SEGMENT_COUNT_LIMIT

  render: ->
    <div id="main-viewport-container">
      <GameCanvas />
      <div id="control-bar">
        <ToggleButton onText="Hide Debug Drawing" offText="Show Debug Drawing" action={->config.mapGeneration.DEBUG = !config.mapGeneration.DEBUG}/>
        <ToggleButton onText="Hide Population Heatmap" offText="Show Population Heatmap" action={->config.mapGeneration.DRAW_HEATMAP = !config.mapGeneration.DRAW_HEATMAP}/>
        <button onClick={_.bind(@_factorTargetZoom, null, 3/2)}>Zoom in</button>
        <button onClick={_.bind(@_factorTargetZoom, null, 2/3)}>Zoom out</button>
        <label htmlFor="segment-limit">Segment limit:</label>
        <input id="segment-limit" onChange={@_onSegmentCountChange} type="number" min="1" max="5000" value={@state.segmentCountLimit} />
        <button onClick={@_regenerateMap}>Regenerate</button>
      </div>
    </div>

  _onSegmentCountChange: (event) ->
    config.mapGeneration.SEGMENT_COUNT_LIMIT = event.target.value
    @setState(segmentCountLimit: event.target.value)

  _regenerateMap: ->
    seed = new Date().getTime()
    MapActions.generate(seed)

  _factorTargetZoom: (factor) ->
      MapActions.factorTargetZoom(factor);

module.exports = App

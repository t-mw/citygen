# @cjsx React.DOM

_ = require('lodash')
React = require('react')

util = require('generic_modules/utility')

EditRoutePanel = require('./EditRoutePanel')
HoverWindow = require('./HoverWindow')
ListView = require('./ListView')
RoutePartialListItem = require('./RoutePartialListItem')

Constants = require('../dispatcher/Constants')

EditVehicleWindow = React.createClass
  getInitialState: ->
    editingRoutePartialIdx: undefined

  render: ->
    listItems = (for i in [0...@props.routePartials.length()] by 1
        <RoutePartialListItem onClick={_.bind(@_onRoutePartialClick, null, i)} routePartialIdx={i} routePartials={@props.routePartials} />
      ).concat(<button onClick={_.bind(@_onNewClick, null, @props.routePartials.length())}>New</button>)

    windowContents =
      <span>
        <div className="row">
          <ListView items={listItems} />
        </div>
        <div className="row">
          {
            editingRoutePartialIdx = if @state.editingRoutePartialIdx? then @state.editingRoutePartialIdx else @props.editingRoutePartialIdx
            if (editingRoutePartialIdx?)
              <EditRoutePanel vehicleId={@props.vehicleData.id} routePartialIdx={editingRoutePartialIdx} routePartials={@props.routePartials} />
          }
        </div>
      </span>
    <HoverWindow onClose={@props.onClose} title="Editing #{@props.vehicleData.id}" contents={windowContents} />

  _onRoutePartialClick: (i) ->
    @setState({editingRoutePartialIdx: i})

  _onNewClick: (newRoutePartialIdx) ->
    @props.setOverlayData({
      mode: Constants.OverlayModes.NEW_ROUTE_PARTIAL_SELECTION
      vehicleId: @props.vehicleData.id
      newRoutePartialIdx: newRoutePartialIdx
    })

module.exports = EditVehicleWindow

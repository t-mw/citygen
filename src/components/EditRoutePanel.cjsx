# @cjsx React.DOM
_ = require('lodash')
React = require('react')

util = require('generic_modules/utility')

build = require('game_modules/build')

RouteActions = require('../actions/RouteActions')

EditRoutePanel = React.createClass
  render: ->
    availableTypes = @props.routePartials.getAvailableCargo(@props.routePartialIdx)
    cargoButtons = (<span className={"cargo" + (if available.supplied then ' supplied' else '')} onClick={_.bind(@_onCargoSelect, null, available.type)}>{available.type}</span> for available in availableTypes)

    supply = @props.routePartials.getGroupedSupply(@props.routePartialIdx, new Date().getTime())
    demand = @props.routePartials.getGroupedDemand(@props.routePartialIdx, new Date().getTime())

    supplyText = ("#{k}: #{Math.floor(v)}" for k, v of supply).join(", ")
    demandText = ("#{k}: #{Math.floor(v)}" for k, v of demand).join(", ")

    pickups = _.pluck(@props.routePartials.getPickups(@props.routePartialIdx), 'resourceType')
    pickupButtons = (<span onClick={_.bind(@_onPickupSelect, null, i)}>{type}</span> for type, i in pickups)

    drops = @props.routePartials.getExpectedDrops(@props.routePartialIdx)
    dropsText = (drop.resourceType for drop in drops).join(" ")

    <div>
      Available cargo: {util.joinArrayGeneric(cargoButtons, " ")}<br/>
      Cargo: {util.joinArrayGeneric(pickupButtons, " ")}<br/>
      Expected drops: {dropsText}<br/>
      Supply: {supplyText}<br/>
      Demand: {demandText}
    </div>

  _onCargoSelect: (type) ->
    RouteActions.addPickup(@props.routePartials.id, @props.routePartialIdx, type, 1)

  _onPickupSelect: (i) ->
    RouteActions.removePickup(@props.routePartials.id, @props.routePartialIdx, i)

module.exports = EditRoutePanel

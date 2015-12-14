# @cjsx React.DOM

React = require('react')

RoutePartialListItem = React.createClass
  render: ->
    pickups = _.pluck(@props.routePartials.getPickups(@props.routePartialIdx), 'resourceType').join(" ")
    <div onClick={@props.onClick}>
      {@props.routePartialIdx}: {pickups}
    </div>

module.exports = RoutePartialListItem
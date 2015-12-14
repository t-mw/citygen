# @cjsx React.DOM

React = require('react')

NewVehicleListItem = React.createClass
  render: ->
      <div onClick={@props.onClick} >
        Type: {@props.vehicleData.type}
      </div>

module.exports = NewVehicleListItem 